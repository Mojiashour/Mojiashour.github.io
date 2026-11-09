/**
 * v4.2 questionnaire content. Item wording is copied verbatim from PhD_Questionnaires_v2.docx (Draft: November 4, 2026),
 * with the Nov 5 change (I-PANAS-SF dropped). Do not edit wording here without updating the docx.
 * v4.2: eligibility/screening items (SCR01–SCR13, SCR18) are omitted for the web-only study; only today's-state
 * items 14–17 are kept (instrument TODAY). Every place where the docx has no final wording is marked  todo: "..."
 * and shown to the experimenter in ?debug=1.
 */
(function () {
  "use strict";
  const STICSA_ITEMS = [
    "My heart beats fast.", "My muscles are tense.", "I feel agonised over my problems.",
    "I think that others won't approve of me.",
    "I feel like I'm missing out on things because I can't make up my mind soon enough.", "I feel dizzy.",
    "My muscles feel weak.", "I feel trembly and shaky.", "I picture some future misfortune.",
    "I can't get some thought out of my mind.", "I have trouble remembering things.", "My face feels hot.",
    "I think that the worst will happen.", "My arms and legs feel stiff.", "My throat feels dry.",
    "I keep busy to avoid uncomfortable thoughts.", "I cannot concentrate without irrelevant thoughts intruding.",
    "My breathing is fast and shallow.", "I worry that I cannot control my thoughts as well as I would like to.",
    "I have butterflies in the stomach.", "My palms feel clammy.",
  ];
  const STICSA_SOMATIC = [1, 2, 6, 7, 8, 12, 14, 15, 18, 20, 21];
  const STICSA_COGNITIVE = [3, 4, 5, 9, 10, 11, 13, 16, 17, 19];
  const yn = [{ v: 1, label: "Yes" }, { v: 0, label: "No" }];
  const scale = (labels, start = 1) => labels.map((l, i) => ({ v: start + i, label: l }));

  const I = {};

  // Eligibility items SCR01–SCR13 and SCR18 were dropped in v4.2 (web-only study, no EEG).
  // Item wording of SCR14–SCR17 is unchanged from the docx.
  I.TODAY = {
    id: "TODAY", title: "Today's state", ref: "Developed for this study.",
    instructions: "Please answer the following questions about how you are today.",
    required: true,
    sections: [{ items: [
      { id: "SCR14", text: "How many hours did you sleep last night?", type: "number", min: 0, max: 24, step: 0.5, unit: "hours" },
      { id: "SCR15", text: "How long ago did you last have caffeine (coffee, tea, energy drink)?", type: "choice",
        options: scale(["None today", "Less than 1 hour", "1–3 hours", "More than 3 hours"]) },
      { id: "SCR16", text: "Have you used nicotine in the past 2 hours?", type: "choice", options: yn },
      { id: "SCR17", text: "Have you done vigorous exercise in the past 2 hours?", type: "choice", options: yn },
    ] }],
  };

  I.VAS = {
    id: "VAS", title: "Stress Visual Analogue Scale", ref: "Lesage, Berjot & Deschamps (2012), Occup Med 62(8), 600–605.",
    instructions: 'Please rate your current level of stress by moving the slider. The left end represents "No stress at all" and the right end represents "Maximum stress imaginable."',
    emphasize: ["current"],
    required: true,
    sections: [{ items: [{ id: "VAS_stress", text: "How stressed do you feel right now?", type: "vas",
      left: "No stress at all", right: "Maximum stress imaginable" }] }],
  };

  // SAM: 9-point pictorial, 5 manikins with selectable points between them. Omitted from the default v4.1
  // flow (enable with ?sam=1). The docx requires the OFFICIAL
  // Bradley & Lang figures; they are not bundled. Put them in assets/sam/ as valence_1..5.png and arousal_1..5.png
  // (1 = left/unpleasant/calm). Until then, labelled placeholder boxes are shown (todo).
  I.SAM = {
    id: "SAM", title: "Self-Assessment Manikin", ref: "Bradley & Lang (1994), J Behav Ther Exp Psychiatry 25(1), 49–59.",
    instructions: "Please select the figure that best represents how you feel right now. You can select any of the figures or the spaces between them.",
    required: true,
    samImages: false, // set true once the official figures are in assets/sam/
    todo: "Official SAM manikin figures not yet added (assets/sam/valence_1..5.png, arousal_1..5.png).",
    sections: [{ items: [
      { id: "SAM_valence", text: "Valence", type: "sam", dim: "valence", left: "Very unpleasant (unhappy)", right: "Very pleasant (happy)" },
      { id: "SAM_arousal", text: "Arousal", type: "sam", dim: "arousal", left: "Very calm (relaxed)", right: "Very excited (aroused)" },
    ] }],
  };

  I.STICSA_S = {
    id: "STICSA_S", title: "STICSA – State", ref: "Ree, French, MacLeod & Locke (2008), Behav Cogn Psychother 36(3), 313–332.",
    instructions: "Below is a list of statements which can be used to describe how people feel. Please read each statement carefully and select the option which best indicates how you feel right now, at this moment.",
    emphasize: ["you feel right now, at this moment"],
    required: true, layout: "matrix",
    sections: [{ options: scale(["Not at all", "A little", "Moderately", "Very much so"]),
      items: STICSA_ITEMS.map((t, i) => ({ id: "STS" + String(i + 1).padStart(2, "0"), text: t, type: "choice" })) }],
  };
  I.STICSA_T = {
    id: "STICSA_T", title: "STICSA – Trait", ref: I.STICSA_S.ref,
    instructions: "Below is a list of statements which can be used to describe how people feel. Please read each statement carefully and select the option which best indicates how you generally feel, that is, how you feel most of the time.",
    emphasize: ["most of the time"],
    required: true, layout: "matrix",
    sections: [{ options: scale(["Almost never", "Occasionally", "Often", "Almost always"]),
      items: STICSA_ITEMS.map((t, i) => ({ id: "STT" + String(i + 1).padStart(2, "0"), text: t, type: "choice" })) }],
  };

  I.TLX = {
    id: "TLX", title: "NASA Task Load Index (Raw TLX, 7-point)", ref: "Hart & Staveland (1988), Advances in Psychology 52, 139–183.",
    instructions: "Please rate the task you just completed.",
    todo: 'Instruction text in the docx is unfinished ("Please rate the task you just completed ..."); shown without the ellipsis until the final wording is supplied.',
    required: true, layout: "matrix",
    sections: [{ options: [1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, label: v === 1 ? "1 – Very low" : v === 7 ? "7 – Very high" : String(v) })),
      items: [
        ["TLX_mental", "Mental Demand: How mentally demanding was the task?"],
        ["TLX_physical", "Physical Demand: How physically demanding was the task?"],
        ["TLX_temporal", "Temporal Demand: How hurried or rushed was the pace of the task?"],
        ["TLX_performance", "Performance: How successful were you in accomplishing what you were asked to do?"],
        ["TLX_effort", "Effort: How hard did you have to work to accomplish your level of performance?"],
        ["TLX_frustration", "Frustration: How insecure, discouraged, irritated, stressed, and annoyed were you?"],
      ].map(([id, text]) => ({ id, text, type: "choice" })) }],
  };

  I.SBSOD = {
    id: "SBSOD", title: "Santa Barbara Sense of Direction Scale", ref: "Hegarty, Richardson, Montello, Lovelace & Subbiah (2002), Intelligence 30(5), 425–447.",
    instructions: "The following statements ask you about your spatial and navigational abilities, preferences, and experiences.",
    required: true, layout: "matrix",
    sections: [{ options: [1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, label: v === 1 ? "1 – Strongly agree" : v === 7 ? "7 – Strongly disagree" : String(v) })),
      items: [
        "I am very good at giving directions.", "I have a poor memory for where I left things.",
        "I am very good at judging distances.", "My “sense of direction” is very good.",
        "I tend to think of my environment in terms of cardinal directions (N, S, E, W).",
        "I very easily get lost in a new city.", "I enjoy reading maps.", "I have trouble understanding directions.",
        "I am very good at reading maps.", "I don’t remember routes very well while riding as a passenger in a car.",
        "I don’t enjoy giving directions.", "It’s not important to me to know where I am.",
        "I usually let someone else do the navigational planning for long trips.",
        "I can usually remember a new route after I have traveled it only once.",
        "I don’t have a very good “mental map” of my environment.",
      ].map((t, i) => ({ id: "SBSOD" + String(i + 1).padStart(2, "0"), text: t, type: "choice" })) }],
  };

  I.SAS = {
    id: "SAS", title: "Spatial Anxiety Scale (13-item revised)", ref: "He & Hegarty (2020), J Environ Psychol 71, 101475 (revised from Lawton, 1994).",
    instructions: "Please rate your level of anxiety on a 5-point scale in the following scenarios. How anxious do you feel when:",
    required: true, layout: "matrix", shuffleItems: true, // docx: shuffle item order for each participant (seeded, logged)
    sections: [{ options: scale(["Not at all", "A little", "A moderate amount", "A lot", "A great deal"]),
      items: [
        "Leaving a store that you have been to for the first time and deciding which way to turn to get to a destination.",
        "Finding your way out of a complex arrangement of offices that you have visited for the first time.",
        "Pointing in the direction of a place outside that someone wants to get to and has asked you for directions when you are in a windowless room.",
        "Locating your car in a very large parking lot or parking garage.",
        "Trying a new route that you think will be a shortcut without the benefits of a map.",
        "Finding your way back to a familiar area after realizing you have made a wrong turn and become lost while traveling.",
        "Finding your way around in an unfamiliar mall.",
        "Finding your way to an appointment in an area of a city or town with which you are not familiar.",
        "Finding your way back to your hotel after becoming lost in a new city.",
        "Asked to follow directions to a location across town without the use of a map.",
        "Trying to get somewhere you have never been to before in the middle of an unfamiliar city.",
        "Asked to do the navigation planning for a long car trip.",
        "Memorizing routes and landmarks on a map for an upcoming event.",
      ].map((t, i) => ({ id: "SAS" + String(i + 1).padStart(2, "0"), text: t, type: "choice" })) }],
  };

  I.EHI = {
    id: "EHI", title: "Edinburgh Handedness Inventory – Short Form", ref: "Veale (2014), Laterality 19(2), 164–177 (short form of Oldfield, 1971).",
    instructions: "Please indicate which hand you prefer for each of the following activities.",
    required: true, layout: "matrix",
    sections: [{ options: [{ v: 100, label: "Always right" }, { v: 50, label: "Usually right" }, { v: 0, label: "Both equally" },
      { v: -50, label: "Usually left" }, { v: -100, label: "Always left" }],
      items: [["EHI_writing", "Writing"], ["EHI_throwing", "Throwing"], ["EHI_toothbrush", "Using a toothbrush"], ["EHI_spoon", "Using a spoon"]]
        .map(([id, text]) => ({ id, text, type: "choice" })) }],
  };

  // Non-identifying only: no name / DOB / contact fields. Item 4 (occupation/field) is the docx's open-text item;
  // its hint asks participants not to enter names or other identifying details.
  I.DEMO = {
    id: "DEMO", title: "Demographics and Background", ref: "Developed for this study.",
    instructions: "Please answer the following questions about yourself. You may skip any question you prefer not to answer.",
    required: false,
    sections: [{ items: [
      { id: "DEM_age", text: "What is your age? (years)", type: "number", min: 18, max: 110, step: 1, unit: "years" },
      { id: "DEM_gender", text: "What is your gender?", type: "choice",
        options: [{ v: "woman", label: "Woman" }, { v: "man", label: "Man" }, { v: "nonbinary", label: "Non-binary" },
          { v: "self", label: "Prefer to self-describe:", other: true }, { v: "pna", label: "Prefer not to say" }] },
      { id: "DEM_education", text: "What is the highest level of education you have completed?", type: "choice",
        options: [{ v: "hs", label: "High school or less" }, { v: "somecollege", label: "Some college" }, { v: "bachelor", label: "Bachelor's degree" },
          { v: "master", label: "Master's degree" }, { v: "doctoral", label: "Doctoral or professional degree" }, { v: "pna", label: "Prefer not to say" }] },
      { id: "DEM_occupation", text: "What is your current occupation or field of study?", type: "text",
        hint: "General field only (e.g., \u201cengineering student\u201d). Please do not enter names or other identifying details." },
      { id: "DEM_race", text: "What is your race/ethnicity? (select all that apply)", type: "multi",
        options: [{ v: "aian", label: "American Indian or Alaska Native" }, { v: "asian", label: "Asian" }, { v: "black", label: "Black or African American" },
          { v: "hispanic", label: "Hispanic or Latino" }, { v: "mena", label: "Middle Eastern or North African" },
          { v: "nhpi", label: "Native Hawaiian or Pacific Islander" }, { v: "white", label: "White" },
          { v: "self", label: "Prefer to self-describe:", other: true }, { v: "pna", label: "Prefer not to say", exclusive: true }] },
      { id: "DEM_english", text: "Is English your first language?", type: "choice",
        options: [{ v: "yes", label: "Yes" }, { v: "no", label: "No (if no, please specify):", other: true }] },
      { id: "DEM_hospfamiliar", text: "How familiar are you with hospital environments?", type: "choice",
        options: [1, 2, 3, 4, 5].map((v) => ({ v, label: v === 1 ? "1 Not at all familiar" : v === 5 ? "5 Extremely familiar" : String(v) })) },
      { id: "DEM_hospvisits", text: "How many times have you visited a hospital in the past 12 months?", type: "choice",
        options: [{ v: "0", label: "0" }, { v: "1-2", label: "1–2" }, { v: "3-5", label: "3–5" }, { v: ">5", label: "More than 5" }] },
      { id: "DEM_healthcarework", text: "Do you work or have you worked in a healthcare setting?", type: "choice",
        options: [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }] },
      { id: "DEM_videogames", text: "How often do you play video games?", type: "choice",
        options: scale(["Never", "Less than once a month", "Monthly", "Weekly", "Daily"]) },
      { id: "DEM_vrexp", text: "How much experience do you have with 360° images, virtual reality, or virtual environments?", type: "choice",
        options: scale(["None", "A little", "Moderate", "A lot"]) },
      { id: "DEM_nature", text: "How much time do you typically spend in natural environments (parks, forests, gardens) per week?", type: "choice",
        options: scale(["Less than 1 hour", "1–3 hours", "3–7 hours", "More than 7 hours"]) },
    ] }],
  };

  /* ---------------- scoring (docx Section 1 rules) ---------------- */
  const S = {};
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
  S.TODAY = () => ({});
  S.VAS = (r) => ({ vas_stress: r.VAS_stress });
  S.SAM = (r) => ({ sam_valence: r.SAM_valence, sam_arousal: r.SAM_arousal });
  const sticsa = (pre) => (r) => {
    const g = (n) => r[pre + String(n).padStart(2, "0")];
    const som = STICSA_SOMATIC.map(g), cog = STICSA_COGNITIVE.map(g);
    const ok = (a) => a.every((x) => typeof x === "number");
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    return { somatic: ok(som) ? sum(som) : null, cognitive: ok(cog) ? sum(cog) : null,
      total: ok(som) && ok(cog) ? sum(som) + sum(cog) : null };
  };
  S.STICSA_S = sticsa("STS");
  S.STICSA_T = sticsa("STT");
  S.TLX = (r) => {
    const k = ["TLX_mental", "TLX_physical", "TLX_temporal", "TLX_performance", "TLX_effort", "TLX_frustration"];
    const v = k.map((x) => (x === "TLX_performance" ? 8 - r[x] : r[x]));
    return { raw_tlx: v.every((x) => typeof x === "number") ? r3(mean(v)) : null, performance_reversed: 8 - r.TLX_performance };
  };
  S.SBSOD = (r) => {
    const pos = [1, 3, 4, 5, 7, 9, 14];
    const v = [];
    for (let i = 1; i <= 15; i++) { const x = r["SBSOD" + String(i).padStart(2, "0")]; if (typeof x === "number") v.push(pos.includes(i) ? 8 - x : x); }
    return { sbsod_mean: v.length === 15 ? r3(mean(v)) : null, n_answered: v.length };
  };
  S.SAS = (r) => {
    const v = [];
    for (let i = 1; i <= 13; i++) { const x = r["SAS" + String(i).padStart(2, "0")]; if (typeof x === "number") v.push(x); }
    return { sas_mean: v.length === 13 ? r3(mean(v)) : null, n_answered: v.length };
  };
  S.EHI = (r) => {
    const v = ["EHI_writing", "EHI_throwing", "EHI_toothbrush", "EHI_spoon"].map((k) => r[k]);
    if (!v.every((x) => typeof x === "number")) return { lq: null, handedness: "" };
    let R = 0, L = 0;
    v.forEach((x) => { if (x > 0) R += x / 50; else if (x < 0) L += -x / 50; });
    const lq = R + L === 0 ? 0 : Math.round((100 * (R - L)) / (R + L) * 10) / 10;
    return { lq, handedness: lq >= 61 ? "right" : lq <= -61 ? "left" : "mixed" };
  };
  S.DEMO = () => ({});

  window.WF_INSTRUMENTS = I;
  window.WF_SCORING = S;
})();
