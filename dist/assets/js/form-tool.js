// Optional WebMCP support. Stage a draft only; never submit or accept consent.
export function registerDemoDraftTool(stageDraft) {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const fields = { firstName:100,lastName:100,title:150,companyName:200,companyWebsite:500,phoneNumber:40,email:254 };
  const properties = Object.fromEntries(Object.entries(fields).map(([key,maxLength]) => [key,{type:'string',maxLength}]));
  properties.referralSource = { type:'string',enum:['search_engine','social_media','referral','event','other'] };
  const inputSchema = {type:'object',properties,additionalProperties:false};
  const tool = {
    name:'stage_demo_request_draft',
    title:'Fill demo request draft',
    description:'Fill the visible Nx. demo form without submitting it or accepting communications or privacy consent. The visitor must review the form, accept consent, and submit it themselves.',
    inputSchema,
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input) {
      if (!input || typeof input!=='object' || Array.isArray(input)) return {staged:false,error:'Expected form fields.'};
      for (const [key,value] of Object.entries(input)) {
        const rule = properties[key];
        if (!rule || typeof value!=='string' || (rule.maxLength && value.length>rule.maxLength) || (rule.enum && !rule.enum.includes(value))) return {staged:false,error:`Invalid field: ${key}`};
      }
      return stageDraft(input);
    },
  };
  // Unsupported browsers and registration failures must not interrupt the form.
  try { Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch {}
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
