/**
 * Consent page copy for the Hospital Wayfinding Study (v5.7).
 * The consent body is still [placeholder] pending final approved language.
 * The agreement, age confirmation and date fields are rendered by app.js.
 * CONSENT_TEXT_VERSION is stored with the participant's decision.
 */
(function () {
  "use strict";
  const CONSENT_TEXT_VERSION = "PLACEHOLDER_v53_2026-11-20";
  const SOP16_VENDORS = "Please note that this study is being conducted with the help of GitHub (website hosting) and Google (data storage), companies not affiliated with Cornell and with their own privacy and security policies that you can find at their websites.";
  const SOP16_INTERNET_RISK = "We anticipate that your participation in this survey presents no greater risk than everyday use of the Internet.";

  const html = `
      <p class="draft-banner"><strong>DRAFT for IRB review</strong> — consent body pending final IRB-approved language.</p>
      <div class="consent-letter">
        <p class="irb-placeholder">[placeholder]</p>

        <h3>Agreement</h3>
        <p>If you are 18 years of age or older, have read this information, and agree to take part, check the box below, enter today’s date, and select <strong>I agree</strong>. If you do not agree, select <strong>I do not agree</strong> and the session will end. If you are under 18, you are not eligible to take part; select <strong>I am under 18</strong>.</p>
      </div>`;

  window.WF_CONSENT_COPY = {
    version: CONSENT_TEXT_VERSION,
    SOP16_VENDORS: SOP16_VENDORS,
    SOP16_INTERNET_RISK: SOP16_INTERNET_RISK,
    html: html,
  };
})();
