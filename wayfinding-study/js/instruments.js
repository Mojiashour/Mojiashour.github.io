/**
 * v5.3 questionnaire content. Validated item wording is copied verbatim from the published instruments.
 * v5.3: 4-dimension VAS; I-PANAS-SF; STICSA Trait only (+ attention check); SBSOD attention check;
 * DEMO nature items (MENE-style); NR-6; English Yes/No only; no free-text "other" on gender/race.
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
  const rangeOpts = (lo, hi, step) => { const o = []; for (let v = lo; v <= hi + 1e-9; v += step) o.push({ v: Math.round(v * 10) / 10, label: String(Math.round(v * 10) / 10) }); return o; };

  I.TODAY = {
    id: "TODAY", title: "Today's state", ref: "Developed for this study.",
    instructions: "Please answer the following questions about how you are today.",
    emphasize: ["today"],
    required: true,
    sections: [{ items: [
      { id: "SCR14", text: "How many hours did you sleep last night?", type: "select", unit: "hours",
        options: rangeOpts(0, 14, 0.5).concat([{ v: 15, label: "More than 14" }]) },
      { id: "SCR15", text: "How long ago did you last have caffeine (coffee, tea, energy drink)?", type: "choice",
        options: scale(["None today", "Less than 1 hour", "1–3 hours", "More than 3 hours"]) },
      { id: "SCR16", text: "Have you used nicotine in the past 2 hours?", type: "choice", options: yn },
      { id: "SCR17", text: "Have you done vigorous exercise in the past 2 hours?", type: "choice", options: yn },
    ] }],
  };

  // Norden et al. 2022 four VAS dimensions (replaces the single stress VAS everywhere).
  I.VAS = {
    id: "VAS", title: "Momentary feelings (VAS)", ref: "Norden et al. (2022), JMIR 24(7):e32280 (four VAS dimensions).",
    heading: "How you feel right now",
    instructions: "Please rate how you feel right now on each of the following.",
    emphasize: ["right now"],
    required: true,
    sections: [{ items: [
      { id: "VAS_stressed", text: "At this moment, do you feel stressed?", type: "vas",
        left: "not at all", right: "very much" },
      { id: "VAS_frustrated", text: "At this moment, do you feel frustrated?", type: "vas",
        left: "not at all", right: "very much" },
      { id: "VAS_overstrained", text: "At this moment, do you feel overstrained?", type: "vas",
        left: "not at all", right: "very much" },
      { id: "VAS_ashamed", text: "At this moment, do you feel ashamed?", type: "vas",
        left: "not at all", right: "very much" },
    ] }],
  };

  // Kept for legacy session export only; not administered in v5.3.
  I.STICSA_S = {
    id: "STICSA_S", title: "STICSA – State", ref: "Ree, French, MacLeod & Locke (2008), Behav Cogn Psychother 36(3), 313–332.",
    instructions: "Below is a list of statements which can be used to describe how people feel. Please read each statement carefully and select the option which best indicates:",
    timeframe: "How you feel right now, at this moment",
    required: true, layout: "matrix",
    sections: [{ options: scale(["Not at all", "A little", "Moderately", "Very much so"]),
      items: STICSA_ITEMS.map((t, i) => ({ id: "STS" + String(i + 1).padStart(2, "0"), text: t, type: "choice" })) }],
  };

  const STICSA_T_ITEMS = STICSA_ITEMS.map((t, i) => ({ id: "STT" + String(i + 1).padStart(2, "0"), text: t, type: "choice" }));
  // Attention check after item 10 (instructed response; excluded from scale scores).
  STICSA_T_ITEMS.splice(10, 0, {
    id: "STT_ATTN", text: 'For this item, please select "Often".', type: "choice", attention: true, attentionValue: 3,
  });

  I.STICSA_T = {
    id: "STICSA_T", title: "STICSA – Trait", ref: I.STICSA_S.ref,
    instructions: "Below is a list of statements which can be used to describe how people feel. Please read each statement carefully and select the option which best indicates:",
    timeframe: "How you generally feel, that is, how you feel most of the time",
    required: true, layout: "matrix",
    sections: [{ options: scale(["Almost never", "Occasionally", "Often", "Almost always"]),
      items: STICSA_T_ITEMS }],
  };

  I.IPANAS = {
    id: "IPANAS", title: "I-PANAS-SF", ref: "Thompson, E. R. (2007). Development and Validation of an Internationally Reliable Short-Form of the Positive and Negative Affect Schedule (PANAS). Journal of Cross-Cultural Psychology, 38(2), 227–242. doi:10.1177/0022022106297301",
    heading: "How you feel right now",
    instructions: "Indicate to what extent you feel this way right now, that is, at the present moment.",
    anchorsRef: "Momentary (state) instructions and 1–5 anchors from Watson, Clark & Tellegen (1988), J Pers Soc Psychol 54(6), 1063–1070.",
    emphasize: ["right now"],
    required: true, layout: "matrix",
    sections: [{ options: scale(["Very slightly or not at all", "A little", "Moderately", "Quite a bit", "Extremely"]),
      items: ["Upset", "Hostile", "Alert", "Ashamed", "Inspired", "Nervous", "Determined", "Attentive", "Afraid", "Active"]
        .map((t) => ({ id: "IPANAS_" + t.toLowerCase(), text: t, type: "choice" })) }],
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

  const SBSOD_ITEMS = [
    "I am very good at giving directions.", "I have a poor memory for where I left things.",
    "I am very good at judging distances.", "My “sense of direction” is very good.",
    "I tend to think of my environment in terms of cardinal directions (N, S, E, W).",
    "I very easily get lost in a new city.", "I enjoy reading maps.", "I have trouble understanding directions.",
    "I am very good at reading maps.", "I don’t remember routes very well while riding as a passenger in a car.",
    "I don’t enjoy giving directions.", "It’s not important to me to know where I am.",
    "I usually let someone else do the navigational planning for long trips.",
    "I can usually remember a new route after I have traveled it only once.",
    "I don’t have a very good “mental map” of my environment.",
  ].map((t, i) => ({ id: "SBSOD" + String(i + 1).padStart(2, "0"), text: t, type: "choice" }));
  SBSOD_ITEMS.splice(7, 0, {
    id: "SBSOD_ATTN", text: "For this item, please select 5.", type: "choice", attention: true, attentionValue: 5,
  });

  I.SBSOD = {
    id: "SBSOD", title: "Santa Barbara Sense of Direction Scale", ref: "Hegarty, Richardson, Montello, Lovelace & Subbiah (2002), Intelligence 30(5), 425–447.",
    instructions: "The following statements ask you about your spatial and navigational abilities, preferences, and experiences.",
    required: true, layout: "matrix",
    sections: [{ options: [1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, label: v === 1 ? "1 – Strongly agree" : v === 7 ? "7 – Strongly disagree" : String(v) })),
      items: SBSOD_ITEMS }],
  };

  I.SAS = {
    id: "SAS", title: "Spatial Anxiety Scale (13-item revised)", ref: "He & Hegarty (2020), J Environ Psychol 71, 101475 (revised from Lawton, 1994).",
    instructions: "Please rate your level of anxiety on a 5-point scale in the following scenarios. How anxious do you feel when:",
    required: true, layout: "matrix", shuffleItems: true,
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

  const PNA = { v: "pna", label: "I prefer not to answer" };
  const PNA_EX = { v: "pna", label: "I prefer not to answer", exclusive: true };

  I.DEMO = {
    id: "DEMO", title: "Demographics and Background", ref: "Developed for this study. Nature visit frequency adapted from Natural England MENE (2018).",
    heading: "About you",
    instructions: "Please answer each question about yourself.",
    required: true,
    sections: [{ items: [
      { id: "DEM_age", text: "What is your age? (years)", type: "select", options: rangeOpts(18, 99, 1) },
      { id: "DEM_gender", text: "What is your gender?", type: "choice",
        options: [{ v: "woman", label: "Woman" }, { v: "man", label: "Man" }, { v: "nonbinary", label: "Non-binary" },
          { v: "others", label: "Others" }, PNA] },
      { id: "DEM_education", text: "What is the highest level of education you have completed?", type: "choice",
        options: [{ v: "hs", label: "High school or less" }, { v: "somecollege", label: "Some college" }, { v: "bachelor", label: "Bachelor's degree" },
          { v: "master", label: "Master's degree" }, { v: "doctoral", label: "Doctoral or professional degree" }, PNA] },
      { id: "DEM_race", text: "What is your race/ethnicity? (select all that apply)", type: "multi",
        options: [{ v: "aian", label: "American Indian or Alaska Native" }, { v: "asian", label: "Asian" }, { v: "black", label: "Black or African American" },
          { v: "hispanic", label: "Hispanic or Latino" }, { v: "mena", label: "Middle Eastern or North African" },
          { v: "nhpi", label: "Native Hawaiian or Pacific Islander" }, { v: "white", label: "White" },
          { v: "others", label: "Others" }, PNA_EX] },
      { id: "DEM_english", text: "Is English your first language?", type: "choice",
        options: [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }] },
      { id: "DEM_hospfamiliar", text: "How familiar are you with hospital environments?", type: "choice",
        display: "hscale", endLabels: ["Not at all familiar", "Extremely familiar"],
        options: [1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) })).concat([PNA]) },
      { id: "DEM_hospvisits", text: "How many times have you visited a hospital in the past 12 months?", type: "choice",
        options: [{ v: "0", label: "0" }, { v: "1-2", label: "1–2" }, { v: "3-5", label: "3–5" }, { v: ">5", label: "More than 5" }, PNA] },
      { id: "DEM_healthcarework", text: "Do you work or have you worked in a healthcare setting?", type: "choice",
        options: [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }, PNA] },
      { id: "DEM_videogames", text: "How often do you play video games?", type: "choice",
        options: scale(["Never", "Less than once a month", "Monthly", "Weekly", "Daily"]).concat([PNA]) },
      { id: "DEM_vrexp", text: "How much experience do you have with 360° images, virtual reality, or virtual environments?", type: "choice",
        options: scale(["None", "A little", "Moderate", "A lot"]).concat([PNA]) },
      { id: "DEM_nature_visit", text: "In the last 12 months, how often, on average, have you spent your leisure time out of doors, away from your home, in natural spaces (e.g., parks, woodland, countryside, beaches)?", type: "choice",
        options: [
          { v: "more_than_once_day", label: "More than once a day" },
          { v: "every_day", label: "Every day" },
          { v: "several_times_week", label: "Several times a week" },
          { v: "once_week", label: "Once a week" },
          { v: "once_twice_month", label: "Once or twice a month" },
          { v: "once_2_3_months", label: "Once every 2-3 months" },
          { v: "once_twice", label: "Once or twice" },
          { v: "never", label: "Never" },
        ] },
      { id: "DEM_nature_media", text: "Do you watch or listen to nature programmes on TV or radio?", type: "choice",
        options: [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }] },
    ] }],
  };

  // NR-6 (Nisbet & Zelenski, 2013). Items need verification against Moj's PDF.
  I.NR6 = {
    id: "NR6", title: "Nature Relatedness Scale – Short Form (NR-6)",
    ref: "Nisbet, E. K., & Zelenski, J. M. (2013). The NR-6: A new brief measure of nature relatedness. Frontiers in Psychology, 4, 813. VERIFY against Nature relatedness.pdf.",
    instructions: "For each of the following, please rate the extent to which you agree with each statement, using the scale from 1 to 5.",
    required: true, layout: "matrix",
    sections: [{ options: [1, 2, 3, 4, 5].map((v) => ({
      v, label: v === 1 ? "1 – Disagree strongly" : v === 5 ? "5 – Agree strongly" : String(v),
    })),
      items: [
        "My ideal vacation spot would be a remote, wilderness area.",
        "I always think about how my actions affect the environment.",
        "My connection to nature and the environment is a part of my spirituality.",
        "I take notice of wildlife wherever I am.",
        "My relationship to nature is an important part of who I am.",
        "I feel very connected to all living things and the earth.",
      ].map((t, i) => ({ id: "NR6_" + String(i + 1).padStart(2, "0"), text: t, type: "choice" })) }],
  };

  const S = {};
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
  S.TODAY = () => ({});
  S.VAS = (r) => ({
    vas_stressed: r.VAS_stressed, vas_frustrated: r.VAS_frustrated,
    vas_overstrained: r.VAS_overstrained, vas_ashamed: r.VAS_ashamed,
    // legacy single-slider key (v5.2 sessions)
    vas_stress: r.VAS_stress,
  });
  const sticsa = (pre) => (r) => {
    const g = (n) => r[pre + String(n).padStart(2, "0")];
    const som = STICSA_SOMATIC.map(g), cog = STICSA_COGNITIVE.map(g);
    const ok = (a) => a.every((x) => typeof x === "number");
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    const out = { somatic: ok(som) ? sum(som) : null, cognitive: ok(cog) ? sum(cog) : null,
      total: ok(som) && ok(cog) ? sum(som) + sum(cog) : null };
    if (pre === "STT" && r.STT_ATTN !== undefined) {
      out.attn_pass = r.STT_ATTN === 3 ? 1 : 0;
      out.attn_value = r.STT_ATTN;
    }
    return out;
  };
  S.STICSA_S = sticsa("STS");
  S.STICSA_T = sticsa("STT");
  S.IPANAS = (r) => {
    const paIds = ["alert", "inspired", "determined", "attentive", "active"].map((x) => "IPANAS_" + x);
    const naIds = ["upset", "hostile", "ashamed", "nervous", "afraid"].map((x) => "IPANAS_" + x);
    const pa = paIds.map((k) => r[k]), na = naIds.map((k) => r[k]);
    const ok = (a) => a.every((x) => typeof x === "number");
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    return { pa: ok(pa) ? sum(pa) : null, na: ok(na) ? sum(na) : null };
  };
  S.TLX = (r) => {
    const k = ["TLX_mental", "TLX_physical", "TLX_temporal", "TLX_performance", "TLX_effort", "TLX_frustration"];
    const v = k.map((x) => (x === "TLX_performance" ? 8 - r[x] : r[x]));
    return { raw_tlx: v.every((x) => typeof x === "number") ? r3(mean(v)) : null, performance_reversed: 8 - r.TLX_performance };
  };
  S.SBSOD = (r) => {
    const pos = [1, 3, 4, 5, 7, 9, 14];
    const v = [];
    for (let i = 1; i <= 15; i++) { const x = r["SBSOD" + String(i).padStart(2, "0")]; if (typeof x === "number") v.push(pos.includes(i) ? 8 - x : x); }
    const out = { sbsod_mean: v.length === 15 ? r3(mean(v)) : null, n_answered: v.length };
    if (r.SBSOD_ATTN !== undefined) {
      out.attn_pass = r.SBSOD_ATTN === 5 ? 1 : 0;
      out.attn_value = r.SBSOD_ATTN;
    }
    return out;
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
  const WEEKLY = new Set(["more_than_once_day", "every_day", "several_times_week", "once_week"]);
  S.DEMO = (r) => {
    const v = r.DEM_nature_visit;
    return {
      nature_visit_weekly: v == null || v === "" || v === "pna" ? null : (WEEKLY.has(String(v)) ? 1 : 0),
    };
  };
  S.NR6 = (r) => {
    const v = [];
    for (let i = 1; i <= 6; i++) { const x = r["NR6_" + String(i).padStart(2, "0")]; if (typeof x === "number") v.push(x); }
    return { nr6_mean: v.length === 6 ? r3(mean(v)) : null, n_answered: v.length };
  };

  window.WF_INSTRUMENTS = I;
  window.WF_SCORING = S;
})();
