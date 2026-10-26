export const referralSources = Object.freeze(['search_engine', 'social_media', 'referral', 'event', 'other']);
const requiredFields = ['firstName', 'lastName', 'title', 'companyName', 'companyWebsite', 'email', 'referralSource'];
const labels = { firstName: 'your first name', lastName: 'your last name', title: 'your job title', companyName: 'your company name', companyWebsite: 'your company website', email: 'your email address', referralSource: 'how you heard about Nx.' };

export function normalizeWebsite(value) {
  const text = value.trim();
  if (!text) return '';
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function validateDemoForm(values) {
  const errors = {};
  for (const field of requiredFields) {
    if (!String(values[field] || '').trim()) errors[field] = `Please enter ${labels[field]}.`;
  }
  if (values.companyWebsite && !normalizeWebsite(values.companyWebsite)) errors.companyWebsite = 'Please enter a valid website, such as company.com.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Please enter a valid email address.';
  if (values.referralSource && !referralSources.includes(values.referralSource)) errors.referralSource = 'Please select an option.';
  if (!values.referralSource) errors.referralSource = 'Please select how you heard about Nx..';
  if (!values.communicationConsent) errors.communicationConsent = 'Please agree before submitting your request.';
  return errors;
}
