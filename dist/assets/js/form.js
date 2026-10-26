import { submitDemoRequest, DemoRequestError } from './api.js';
import { normalizeWebsite, validateDemoForm } from './validation.js';
import { registerDemoDraftTool } from './form-tool.js';
import { enhanceSelect } from './select.js';

const form = document.querySelector('#demo-form');
const button = document.querySelector('#submit-button');
const label = document.querySelector('#submit-label');
const spinner = button.querySelector('.button-spinner');
const message = document.querySelector('#form-message');
const success = document.querySelector('#success-state');
const referralPicker = enhanceSelect(document.querySelector('#referralSource'));
let submitting = false;
let requestId = null;
let requestSignature = null;

function valuesFromForm() {
  return Object.fromEntries(Array.from(form.elements)
    .filter((element) => element.name)
    .map((element) => [element.name, element.type === 'checkbox' ? element.checked : element.value.trim()]));
}

function showFieldError(name, text) {
  const input = form.elements.namedItem(name);
  const error = document.getElementById(`${name}-error`);
  if (!input || !error) return;
  input.setAttribute('aria-invalid', text ? 'true' : 'false');
  error.textContent = text;
  error.hidden = !text;
}

function clearErrors() {
  for (const input of Array.from(form.elements)) if (input.name) showFieldError(input.name, '');
  message.hidden = true;
  message.textContent = '';
}

function showMessage(text, kind = 'error') {
  message.textContent = text;
  message.dataset.kind = kind;
  message.setAttribute('role', kind === 'notice' ? 'status' : 'alert');
  message.hidden = false;
  message.focus();
}

for (const input of Array.from(form.elements)) {
  if (!input.name) continue;
  const eventName = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
  input.addEventListener(eventName, () => {
    if (input.getAttribute('aria-invalid') === 'true') showFieldError(input.name, validateDemoForm(valuesFromForm())[input.name] || '');
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;
  clearErrors();
  const values = valuesFromForm();
  const errors = validateDemoForm(values);
  // Keep the browser's maxlength and email constraints as a second validation layer.
  for (const input of Array.from(form.elements)) {
    if (input.name && !input.validity.valid && !errors[input.name]) errors[input.name] = 'Please check this field.';
  }
  if (Object.keys(errors).length) {
    for (const [name, text] of Object.entries(errors)) showFieldError(name, text);
    const firstError = Object.keys(errors)[0];
    if (firstError === 'referralSource') referralPicker.focus();
    else form.elements.namedItem(firstError)?.focus();
    return;
  }
  const payload = {
    ...values,
    companyWebsite: normalizeWebsite(values.companyWebsite),
    phoneNumber: values.phoneNumber || null,
    privacyPolicyAccepted: true,
    source: 'nx-web',
  };
  const signature = JSON.stringify(payload);
  if (signature !== requestSignature || !requestId) {
    requestId = crypto.randomUUID();
    requestSignature = signature;
  }
  submitting = true;
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  spinner.hidden = false;
  label.textContent = 'Sending…';
  // Prevent editing the submitted values until the request completes.
  const controls = Array.from(form.elements).filter((element) => element.name);
  for (const control of controls) control.disabled = true;
  try {
    await submitDemoRequest(payload, requestId);
    form.hidden = true;
    success.hidden = false;
    success.focus();
  } catch (error) {
    if (error instanceof DemoRequestError && error.code === 'backend_not_connected') {
      showMessage('Your form is complete. Demo requests aren’t enabled in this preview yet. Your details have not been received by Nx..', 'notice');
    } else if (error instanceof DemoRequestError && error.status === 422) {
      const backendErrors = error.fieldErrors && typeof error.fieldErrors === 'object' ? error.fieldErrors : {};
      for (const name of Object.keys(backendErrors)) showFieldError(name, 'Please check this field.');
      showMessage('Please check the highlighted fields and try again.');
    } else if (error instanceof DemoRequestError && error.status === 429) {
      showMessage('Too many requests. Please wait a moment and try again.');
    } else if (error instanceof DemoRequestError && error.code === 'timeout') {
      showMessage('This is taking longer than expected. Please try again in a moment.');
    } else {
      showMessage('We couldn’t send your request. Please try again, or email hello@nx-growth.com.');
    }
  } finally {
    submitting = false;
    button.disabled = false;
    form.removeAttribute('aria-busy');
    spinner.hidden = true;
    label.textContent = 'Submit';
    for (const control of controls) control.disabled = false;
  }
});

registerDemoDraftTool(draft => {
  if (submitting || form.hidden) return {staged:false,error:'The form is not available for editing.'};
  for (const [name,value] of Object.entries(draft)) form.elements.namedItem(name).value=value;
  referralPicker.sync();
  clearErrors();
  const errors = validateDemoForm(valuesFromForm());
  for (const [name,text] of Object.entries(errors)) showFieldError(name,text);
  const firstField = Object.keys(draft)[0] || 'firstName';
  if (firstField === 'referralSource') referralPicker.focus();
  else form.elements.namedItem(firstField)?.focus();
  return {staged:true,submitted:false,fieldsToReview:Object.keys(errors)};
});
