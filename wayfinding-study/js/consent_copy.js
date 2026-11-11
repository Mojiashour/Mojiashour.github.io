/**
 * v4.9 draft consent copy for IRB review (SOP 16 / Cornell informed-consent elements).
 * Bannered as DRAFT in the app. Do not treat as approved language.
 * CONSENT_TEXT_VERSION is logged with the click-through decision.
 */
(function () {
  "use strict";
  const CONSENT_TEXT_VERSION = "DRAFT_SOP16_2026-11-11_v49";
  const SOP16_VENDORS = "Please note that this study is being conducted with the help of GitHub (website hosting) and Google (data storage), companies not affiliated with Cornell and with their own privacy and security policies that you can find at their websites.";
  const SOP16_INTERNET_RISK = "We anticipate that your participation in this survey presents no greater risk than everyday use of the Internet.";

  const html = `
      <p class="draft-banner"><strong>DRAFT for IRB review</strong> — this is not final, IRB-approved consent language. The protocol number, faculty-advisor contact details, compensation, and approval date are placeholders.</p>
      <div class="consent-letter">
        <p class="consent-org">Cornell University<br>Department of Human Centered Design</p>
        <p><strong>Study title:</strong> [PLACEHOLDER: official IRB study title. Working title: Hospital Wayfinding Study]</p>
        <p><strong>Protocol number:</strong> [PLACEHOLDER: IRB protocol number, once assigned]</p>
        <p><strong>Student researcher:</strong> Mojtaba Ashour, Ph.D. student, Human Centered Design, Cornell University, <a href="mailto:ma2236@cornell.edu">ma2236@cornell.edu</a></p>
        <p><strong>Faculty advisor:</strong> Saleh Kalantari, Ph.D., Human Centered Design, Cornell University, [PLACEHOLDER: email and phone]</p>

        <p>You are invited to take part in a research study. This page explains the study so you can decide whether you want to participate. Please read it carefully. You may print or save a copy of this page for your records. You may also ask questions before you agree, by contacting the study team at the addresses below.</p>

        <h3>Purpose</h3>
        <p>The purpose of this study is to learn how people find their way at intersections in hospital-like environments, and how that experience relates to how people feel and how they usually find their way. The findings may help inform the design of healthcare environments.</p>

        <h3>Procedures</h3>
        <p>If you agree to take part, you will be asked to:</p>
        <ul>
          <li>Confirm that you are 18 years of age or older.</li>
          <li>Answer questions about how you feel today and how you feel in general, including brief questionnaires about stress, anxiety, sense of direction, spatial anxiety, handedness, and how demanding the task felt.</li>
          <li>Complete a short practice of the wayfinding task so you can get used to the controls.</li>
          <li>Complete two short, timed mental arithmetic checks, one before each wayfinding part. Each problem has a short time (5 seconds) to answer.</li>
          <li>Complete two wayfinding parts. In each part you will view a series of hospital corridor intersections on the screen, look around with the mouse, and choose left or right with the keyboard to reach a destination. At each intersection you will have a short time (3 seconds) to choose a direction. If you do not choose in time, a “Time’s up” message appears and the study moves on to the next intersection. Some intersections include a short memory question about a recent turn.</li>
          <li>After each destination and after each wayfinding part, rate how you feel and how demanding the task was.</li>
          <li>Answer questions about yourself at the end, including your age and other background questions. Age is required. For the other background questions you may choose “I prefer not to answer.”</li>
        </ul>
        <p>In order to study how people find their way under typical everyday conditions, some details of the procedures will be explained more fully at the end of the session.</p>
        <p>The questionnaires in this study must be completed in order to participate. You may stop the session at any time by selecting <strong>Withdraw</strong>, which remains available on the screen throughout the session.</p>

        <h3>Time commitment</h3>
        <p>We expect the session to take about 45 to 70 minutes. The exact length will be confirmed in a timed pilot and updated here if needed. You should take part on a laptop or desktop computer with a keyboard, in a quiet place, without closing or switching away from this window until the session ends.</p>

        <h3>Risks</h3>
        <p>${SOP16_INTERNET_RISK}</p>
        <p>Some people may feel brief, mild stress or frustration during the timed arithmetic checks, or when choosing a direction under a short time limit at each intersection, similar to the feeling of being under time pressure on a short test. Some people may also feel mild motion discomfort or eye strain while looking around in the 360° images, similar to looking at a moving image on a screen. You may rest or withdraw at any time if you feel uncomfortable.</p>

        <h3>Benefits</h3>
        <p>You will not receive a direct personal benefit from taking part. The study may indirectly benefit others by informing research and design related to wayfinding in healthcare settings. Learning about how a research study is conducted, if applicable, is not a direct benefit. [PLACEHOLDER: if an educational benefit applies, describe it; course credit or payment should be described under Compensation, not as a benefit.]</p>

        <h3>Compensation</h3>
        <p>[PLACEHOLDER: describe course credit, payment, a raffle, or state that there is no compensation. If completing the session is required to receive compensation, say so clearly, and say what happens if someone withdraws partway through.]</p>

        <h3>Voluntary participation</h3>
        <p>Taking part in this study is voluntary. You may refuse to participate before the study begins. You may withdraw at any time by selecting <strong>Withdraw</strong>, with no penalty, and with no effect on your academic standing or record, or on compensation already earned, if any. [PLACEHOLDER: if compensation requires completing the session, revise this sentence accordingly.]</p>
        <p>Because this study does not collect your name or other identifying information, once your responses have been submitted we may not be able to find and remove your specific data unless you have kept your study ID and can provide it to the research team.</p>

        <h3>Confidentiality</h3>
        <p>Nothing that identifies you is collected. You are known in the data only by a randomly assigned study code. We do not collect your name, email address, IP address, or date of birth. The data may be used in publications, presentations, and future analyses in de-identified form.</p>
        <p>${SOP16_VENDORS}</p>
        <p>The researcher will keep the study records for at least three years beyond the end of the study.</p>

        <h3>Questions and concerns</h3>
        <p>If you have questions about the study, or questions before or during your participation, you may contact:</p>
        <ul>
          <li>Mojtaba Ashour, student researcher, <a href="mailto:ma2236@cornell.edu">ma2236@cornell.edu</a></li>
          <li>Saleh Kalantari, Ph.D., faculty advisor, [PLACEHOLDER: email and phone]</li>
        </ul>
        <p>If you have concerns or complaints about this study, you may contact the Cornell Institutional Review Board for Human Participant Research (IRB) at <a href="mailto:irbhp@cornell.edu">irbhp@cornell.edu</a>, 607-255-5138, or <a href="https://researchservices.cornell.edu/offices/IRB" target="_blank" rel="noopener">https://researchservices.cornell.edu/offices/IRB</a>. Concerns may also be reported anonymously through EthicsPoint at <a href="https://www.hotline.cornell.edu" target="_blank" rel="noopener">www.hotline.cornell.edu</a> or by calling toll-free 1-866-293-3077. EthicsPoint is an independent organization that serves as a liaison between the University and the person bringing the complaint so that anonymity can be ensured.</p>
        <p>This consent form will be kept by the researcher for at least three years beyond the end of the study and was approved by the IRB on [PLACEHOLDER: IRB approval date].</p>

        <h3>Agreement</h3>
        <p>If you are 18 years of age or older, have read this information, and agree to take part, check the box below, enter today’s date, and select <em>I agree</em>. If you do not agree, select <em>I do not agree</em> and the session will end. If you are under 18, you are not eligible to take part; select <em>I am under 18</em>.</p>
      </div>`;

  window.WF_CONSENT_COPY = {
    version: CONSENT_TEXT_VERSION,
    SOP16_VENDORS: SOP16_VENDORS,
    SOP16_INTERNET_RISK: SOP16_INTERNET_RISK,
    html: html,
  };
})();
