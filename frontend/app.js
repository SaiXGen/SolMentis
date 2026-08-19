const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

let stream = null;
let expressionModelReady = false;
let currentExpression = "neutral";
let currentExpressionScore = 0;
let moodChart = null;

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

/* =========================================================
   TRIGGER DATABASE
========================================================= */

const TRIGGERS = {
  exams: [
    "exam", "exams", "test", "semester", "cia",
    "study", "studying", "marks", "result"
  ],

  career: [
    "career", "job", "placement", "future",
    "interview", "resume", "work"
  ],

  college: [
    "college", "class", "professor",
    "assignment", "project", "campus"
  ],

  sleep: [
    "sleep", "sleeping", "insomnia",
    "tired", "awake", "rest"
  ],

  relationships: [
    "relationship", "breakup", "love",
    "girlfriend", "boyfriend", "friend", "lonely"
  ],

  money: [
    "money", "financial", "loan",
    "debt", "salary"
  ],

  family: [
    "family", "parents", "mother",
    "father", "home"
  ]
};


/* =========================================================
   SAFETY / DISTRESS SIGNALS
========================================================= */

const DISTRESS_WORDS = [
  "hopeless",
  "helpless",
  "worthless",
  "alone",
  "lonely",
  "overwhelmed",
  "can't cope",
  "cannot cope",
  "give up",
  "giving up",
  "no hope",
  "nothing matters",
  "extremely stressed",
  "very depressed",
  "breakdown",
  "panic",
  "terrified"
];


/*
  Strong safety-sensitive phrases are intentionally kept
  separate from ordinary stress words.

  The app does NOT diagnose a condition.
  It only identifies text that may need extra support.
*/

const HIGH_DISTRESS_PHRASES = [
  "want to die",
  "don't want to live",
  "do not want to live",
  "kill myself",
  "end my life",
  "hurt myself",
  "harm myself",
  "suicide"
];


/* =========================================================
   LOAD FACE EXPRESSION MODEL
========================================================= */

async function loadExpressionModel() {

  try {

    document.getElementById("modelStatus").textContent =
      "Expression AI model: loading...";

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

    expressionModelReady = true;

    document.getElementById("modelStatus").textContent =
      "Expression AI model: ready";

  } catch (error) {

    console.error(error);

    document.getElementById("modelStatus").textContent =
      "Expression AI model: failed to load — check internet connection";
  }
}

loadExpressionModel();


/* =========================================================
   CAMERA
========================================================= */

async function startCamera() {

  try {

    stream = await navigator.mediaDevices.getUserMedia({

      video: {
        facingMode: "user"
      },

      audio: false

    });

    video.srcObject = stream;

    statusEl.textContent = "Camera on";

    await video.play();

    canvas.width = video.videoWidth || 640;

    canvas.height = video.videoHeight || 400;

  } catch (error) {

    console.error(error);

    statusEl.textContent =
      "Camera permission needed";

    alert(
      "Please allow camera access in your browser."
    );
  }
}

document
  .getElementById("startCamera")
  .onclick = startCamera;


/* =========================================================
   CANVAS RESIZE
========================================================= */

function resizeCanvas() {

  if (!video.videoWidth) return;

  canvas.width = video.videoWidth;

  canvas.height = video.videoHeight;
}


/* =========================================================
   FIND STRONGEST EXPRESSION
========================================================= */

function bestExpression(expressions) {

  let best = [
    "neutral",
    0
  ];

  for (
    const [name, score]
    of Object.entries(expressions)
  ) {

    if (score > best[1]) {

      best = [
        name,
        score
      ];
    }
  }

  return best;
}


/* =========================================================
   EXPRESSION LABEL
========================================================= */

function expressionLabel(name) {

  const labels = {

    happy:
      "😊 Happy",

    neutral:
      "😐 Neutral",

    sad:
      "😟 Sad-like",

    angry:
      "😠 Angry-like",

    fearful:
      "😨 Fear-like",

    disgusted:
      "😕 Disgust-like",

    surprised:
      "😮 Surprised"
  };

  return labels[name] || name;
}


/* =========================================================
   FACE EXPRESSION DETECTION
========================================================= */

async function detectExpression() {

  if (
    !expressionModelReady ||
    video.readyState < 2
  ) {

    requestAnimationFrame(
      detectExpression
    );

    return;
  }


  resizeCanvas();


  const detection =
    await faceapi

      .detectSingleFace(

        video,

        new faceapi.TinyFaceDetectorOptions({

          inputSize: 224,

          scoreThreshold: 0.5

        })

      )

      .withFaceExpressions();


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (!detection) {

    currentExpression =
      "neutral";

    currentExpressionScore =
      0;

    document.getElementById(
      "faceSignal"
    ).textContent =
      "Expression signal: no face detected";

    requestAnimationFrame(
      detectExpression
    );

    return;
  }


  const resized =
    faceapi.resizeResults(

      detection,

      {
        width:
          canvas.width,

        height:
          canvas.height
      }
    );


  const box =
    resized.detection.box;


  ctx.strokeStyle =
    "#7cf0c2";

  ctx.lineWidth = 3;

  ctx.strokeRect(

    box.x,
    box.y,
    box.width,
    box.height
  );


  [
    currentExpression,
    currentExpressionScore
  ] =
    bestExpression(
      resized.expressions
    );


  document.getElementById(
    "faceSignal"
  ).textContent =

    `Expression signal: ${
      expressionLabel(currentExpression)
    } (${
      Math.round(
        currentExpressionScore * 100
      )
    }%)`;


  requestAnimationFrame(
    detectExpression
  );
}


video.addEventListener(
  "loadedmetadata",
  () => {

    resizeCanvas();

    detectExpression();

  }
);


/* =========================================================
   HISTORY
========================================================= */

function getHistory() {

  return JSON.parse(

    localStorage.getItem(
      "mindguard_history"
    ) || "[]"

  );
}


function saveHistory(history) {

  localStorage.setItem(

    "mindguard_history",

    JSON.stringify(
      history.slice(0, 30)
    )
  );
}


/* =========================================================
   TRIGGER DETECTION
========================================================= */

function detectTriggers(text) {

  const lower =
    text.toLowerCase();

  const found = [];


  for (
    const [name, words]
    of Object.entries(TRIGGERS)
  ) {

    const hits =
      words.filter(
        word =>
          lower.includes(word)
      );


    if (hits.length) {

      found.push({

        name,

        count:
          hits.length,

        words:
          hits
      });
    }
  }


  return found;
}


/* =========================================================
   DISTRESS DETECTION
========================================================= */

function detectDistress(text) {

  const lower =
    text.toLowerCase();

  const normalSignals =
    DISTRESS_WORDS.filter(
      word =>
        lower.includes(word)
    );


  const highSignals =
    HIGH_DISTRESS_PHRASES.filter(
      phrase =>
        lower.includes(phrase)
    );


  return {

    normalSignals,

    highSignals,

    normalCount:
      normalSignals.length,

    highCount:
      highSignals.length
  };
}


/* =========================================================
   TRIGGER COUNTS
========================================================= */

function allTriggerCounts(history) {

  const counts = {};


  for (
    const item of history
  ) {

    for (
      const trigger
      of (item.triggers || [])
    ) {

      counts[trigger] =
        (counts[trigger] || 0) + 1;
    }
  }


  return Object.entries(counts)

    .map(
      ([name, count]) => ({
        name,
        count
      })
    )

    .sort(
      (a, b) =>
        b.count - a.count
    );
}


/* =========================================================
   TREND
========================================================= */

function calculateTrend(history) {

  const recent =
    history
      .slice(0, 5)
      .reverse();


  if (
    recent.length < 2
  ) {

    return {

      label:
        "No data",

      cls:
        "neutral",

      change:
        0
    };
  }


  const first =
    recent[0].score;

  const last =
    recent[
      recent.length - 1
    ].score;


  const change =
    last - first;


  if (change >= 12) {

    return {

      label:
        "Rising",

      cls:
        "rising",

      change
    };
  }


  if (change <= -12) {

    return {

      label:
        "Improving",

      cls:
        "improving",

      change
    };
  }


  return {

    label:
      "Stable",

    cls:
      "neutral",

    change
  };
}


/* =========================================================
   PHASE 4 — SAFETY SCORE
========================================================= */

function calculateSafety(history) {

  if (!history.length) {

    return {

      level:
        "Low",

      score:
        0,

      className:
        "low",

      signal:
        "No concern detected",

      message:
        "Your recent signals look relatively stable."
    };
  }


  const recent =
    history.slice(0, 5);


  const latest =
    recent[0];


  let safetyScore =
    latest.score || 0;


  /*
    Repeated concern signals
  */

  const highConcernCount =
    recent.filter(
      item =>
        item.score >= 70
    ).length;


  if (
    highConcernCount >= 2
  ) {

    safetyScore += 10;
  }


  /*
    Rising trend
  */

  const trend =
    calculateTrend(history);


  if (
    trend.cls === "rising"
  ) {

    safetyScore += 10;
  }


  /*
    Repeated distress signals
  */

  const distressCount =
    recent.reduce(

      (total, item) =>
        total +
        (item.distressCount || 0),

      0
    );


  safetyScore +=
    Math.min(
      15,
      distressCount * 5
    );


  /*
    High safety-sensitive phrase
  */

  const criticalDetected =
    recent.some(
      item =>
        item.highDistress
    );


  /*
    Clamp score
  */

  safetyScore =
    Math.min(
      100,
      Math.round(
        safetyScore
      )
    );


  /*
    CRITICAL
  */

  if (criticalDetected) {

    return {

      level:
        "Critical",

      score:
        Math.max(
          safetyScore,
          90
        ),

      className:
        "critical",

      signal:
        "Immediate safety concern",

      message:
        "Some recent language may indicate an immediate safety concern. Please consider contacting a trusted person or appropriate emergency/crisis support now."
    };
  }


  /*
    HIGH
  */

  if (
    safetyScore >= 75
  ) {

    return {

      level:
        "High",

      score:
        safetyScore,

      className:
        "high",

      signal:
        "Repeated distress signals",

      message:
        "Your recent check-ins show elevated distress signals. Consider taking a break and reaching out to someone you trust."
    };
  }


  /*
    MODERATE
  */

  if (
    safetyScore >= 45
  ) {

    return {

      level:
        "Moderate",

      score:
        safetyScore,

      className:
        "moderate",

      signal:
        "Some concern detected",

      message:
        "Your recent check-ins show some stress or concern. A short reset, breathing exercise, or conversation with someone you trust may help."
    };
  }


  /*
    LOW
  */

  return {

    level:
      "Low",

    score:
      safetyScore,

    className:
      "low",

    signal:
      "Low concern",

    message:
      "Your recent signals look relatively stable. Keep healthy routines and take breaks when needed."
  };
}


/* =========================================================
   RENDER SAFETY UI
========================================================= */

function renderSafety(history) {

  const result =
    calculateSafety(
      history
    );


  const badge =
    document.getElementById(
      "riskBadge"
    );

  const level =
    document.getElementById(
      "riskLevel"
    );

  const score =
    document.getElementById(
      "riskScore"
    );

  const signal =
    document.getElementById(
      "riskSignal"
    );

  const message =
    document.getElementById(
      "safetyMessage"
    );


  if (!badge) return;


  const icons = {

    Low:
      "🟢",

    Moderate:
      "🟡",

    High:
      "🟠",

    Critical:
      "🔴"
  };


  badge.textContent =
    `${icons[result.level]} ${result.level}`;


  badge.className =
    `risk-badge ${result.className}`;


  level.textContent =
    result.level;


  score.textContent =
    `${result.score}%`;


  signal.textContent =
    result.signal;


  message.textContent =
    result.message;
}


/* =========================================================
   CHART
========================================================= */

function renderChart(history) {

  const points =
    history
      .slice(0, 7)
      .reverse();


  const labels =
    points.map(
      x =>
        x.time.split(",")[0]
    );


  const data =
    points.map(
      x =>
        x.score
    );


  const chartCanvas =
    document.getElementById(
      "moodChart"
    );


  if (moodChart) {

    moodChart.destroy();
  }


  moodChart =
    new Chart(

      chartCanvas,

      {

        type:
          "line",

        data: {

          labels,

          datasets: [

            {

              label:
                "Concern %",

              data,

              tension:
                0.3,

              fill:
                false
            }

          ]
        },


        options: {

          responsive:
            true,

          maintainAspectRatio:
            false,

          scales: {

            y: {

              min:
                0,

              max:
                100
            }
          }
        }
      }
    );
}


/* =========================================================
   TRIGGER UI
========================================================= */

function renderTriggers(history) {

  const box =
    document.getElementById(
      "triggers"
    );


  const counts =
    allTriggerCounts(
      history
    ).slice(0, 6);


  if (!counts.length) {

    box.innerHTML =
      '<div class="empty">No recurring triggers detected yet.</div>';

    return;
  }


  const max =
    counts[0].count;


  box.innerHTML =
    counts.map(

      x => {

        const width =
          Math.max(

            12,

            Math.round(
              (x.count / max) * 100
            )
          );


        return `

          <div class="trigger">

            <div class="trigger-head">

              <b>
                ${x.name}
              </b>

              <span>
                ${x.count}
                check-in${x.count > 1 ? "s" : ""}
              </span>

            </div>

            <div class="bar">

              <i
                style="width:${width}%">
              </i>

            </div>

          </div>

        `;
      }

    ).join("");
}


/* =========================================================
   SUPPORT CARDS
========================================================= */

function renderSupport(history) {

  const box =
    document.getElementById(
      "supportCards"
    );


  const latest =
    history[0];


  if (!latest) return;


  const cards = [];


  if (
    latest.score >= 70
  ) {

    cards.push([

      "🫁 Breathing",

      "Try a slow 60-second breathing exercise before doing the next task."
    ]);

  }

  else if (
    latest.score >= 40
  ) {

    cards.push([

      "🌿 Grounding",

      "Pause for a minute and notice five things you can see, four you can touch, and three you can hear."
    ]);

  }

  else {

    cards.push([

      "☀️ Maintain",

      "Your latest signal looks relatively calm. Keep your routine and take regular breaks."
    ]);
  }


  const triggers =
    allTriggerCounts(
      history
    );


  if (
    triggers[0]?.name ===
    "exams"
  ) {

    cards.push([

      "📚 Study reset",

      "Try one small 25-minute study block instead of focusing on the whole exam at once."
    ]);

  }

  else if (
    triggers[0]?.name ===
    "sleep"
  ) {

    cards.push([

      "😴 Rest",

      "Consider a consistent wind-down routine and a short screen break before sleep."
    ]);

  }

  else if (
    triggers[0]?.name ===
    "career"
  ) {

    cards.push([

      "💼 Career step",

      "Choose one small career action today: update one project, skill, or resume section."
    ]);

  }

  else {

    cards.push([

      "📝 Journaling",

      "Write one sentence about what is bothering you and one small action you can control."
    ]);
  }


  cards.push([

    "🤝 Connection",

    "If you want support, consider talking to someone you trust."
  ]);


  box.innerHTML =
    cards.map(

      c => `

        <div class="support-card">

          <b>
            ${c[0]}
          </b>

          <span>
            ${c[1]}
          </span>

        </div>

      `

    ).join("");
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const history =
    getHistory();


  renderChart(
    history
  );


  renderTriggers(
    history
  );


  renderSupport(
    history
  );


  renderSafety(
    history
  );


  const trend =
    calculateTrend(
      history
    );


  const badge =
    document.getElementById(
      "trendBadge"
    );


  badge.textContent =
    trend.label;


  badge.className =
    `trend ${trend.cls}`;


  const trendText =
    document.getElementById(
      "trendText"
    );


  if (
    history.length < 2
  ) {

    trendText.textContent =
      "Complete a few check-ins to see whether your concern signals are changing.";

  }

  else if (
    trend.cls ===
    "rising"
  ) {

    trendText.textContent =
      `Recent concern signals are trending upward by about ${Math.abs(trend.change)} points across the recent check-ins.`;

  }

  else if (
    trend.cls ===
    "improving"
  ) {

    trendText.textContent =
      `Recent concern signals are trending downward by about ${Math.abs(trend.change)} points.`;

  }

  else {

    trendText.textContent =
      "Recent concern signals look relatively stable.";
  }
}


/* =========================================================
   HISTORY UI
========================================================= */

function renderHistory() {

  const box =
    document.getElementById(
      "history"
    );


  const history =
    getHistory();


  box.innerHTML =

    history.length

      ? history
          .slice(0, 12)
          .map(

            x => `

              <div>

                ${x.time}

                <br>

                <b>
                  ${x.emotion}
                </b>

                ·

                ${expressionLabel(
                  x.expression
                )}

                ·

                ${x.score}%
                concern

                ${
                  x.triggers?.length

                    ? `
                      <br>
                      <small>
                        Triggers:
                        ${x.triggers.join(", ")}
                      </small>
                    `

                    : ""
                }

              </div>

            `
          )
          .join("")

      : "<small>No check-ins yet.</small>";


  renderDashboard();
}


/* =========================================================
   ANALYZE USER CHECK-IN
========================================================= */

async function analyze() {

  const text =
    document
      .getElementById(
        "message"
      )
      .value
      .trim();


  if (!text) {

    alert(
      "Write how you are feeling first."
    );

    return;
  }


  try {

    const response =
      await fetch(

        "http://127.0.0.1:8000/analyze",

        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              text,

              face_emotion:
                currentExpression
            })
        }
      );


    if (!response.ok) {

      throw new Error(
        `Backend returned ${response.status}`
      );
    }


    const data =
      await response.json();


    /*
      TEXT SIGNAL
    */

    const textConcern =
      Number(
        data.score || 0
      );


    /*
      CAMERA SIGNAL

      Only concerning expressions
      contribute to concern score.
    */

    const faceConcern =

      [
        "sad",
        "fearful",
        "angry",
        "disgusted"
      ].includes(
        currentExpression
      )

        ? currentExpressionScore

        : 0;


    /*
      MULTIMODAL SCORE

      Text = 75%
      Camera = 25%
    */

    const concernScore =
      Math.round(

        Math.min(

          100,

          (
            textConcern * 0.75 +

            faceConcern * 0.25
          ) * 100
        )
      );


    /*
      TRIGGERS
    */

    const triggerMatches =
      detectTriggers(
        text
      );


    const triggerNames =
      triggerMatches.map(
        x => x.name
      );


    /*
      DISTRESS SIGNALS
    */

    const distress =
      detectDistress(
        text
      );


    /*
      DISPLAY RESULTS
    */

    document.getElementById(
      "textEmotion"
    ).textContent =
      data.emotion;


    document.getElementById(
      "faceEmotion"
    ).textContent =
      expressionLabel(
        currentExpression
      );


    document.getElementById(
      "score"
    ).textContent =
      `${concernScore}%`;


    /*
      PERSONALIZED SUGGESTION
    */

    let suggestion;


    if (
      distress.highCount > 0
    ) {

      suggestion =
        "Your message may indicate serious distress. Please consider contacting someone you trust or appropriate emergency/crisis support now.";

    }

    else if (
      concernScore >= 70
    ) {

      suggestion =
        "You may be under noticeable stress. Try a 60-second breathing exercise and consider reaching out to someone you trust.";

    }

    else if (
      concernScore >= 40
    ) {

      suggestion =
        "It may help to take a short break, hydrate, and try a simple breathing or grounding exercise.";

    }

    else {

      suggestion =
        "Your signals look relatively calm. Keep a healthy routine and take breaks when you need them.";
    }


    if (
      triggerNames.includes(
        "exams"
      )
    ) {

      suggestion +=
        " Since exams appear in this check-in, focus on one small study task at a time.";
    }


    document.getElementById(
      "suggestion"
    ).textContent =
      suggestion;


    /*
      SAVE CHECK-IN
    */

    const history =
      getHistory();


    history.unshift({

      time:
        new Date()
          .toLocaleString(),

      emotion:
        data.emotion,

      expression:
        currentExpression,

      score:
        concernScore,

      triggers:
        triggerNames,

      distressCount:
        distress.normalCount,

      highDistress:
        distress.highCount > 0
    });


    saveHistory(
      history
    );


    /*
      REFRESH EVERYTHING
    */

    renderHistory();


  }

  catch (error) {

    console.error(
      error
    );


    alert(
      "Could not connect to the backend. Make sure uvicorn is running on port 8000."
    );
  }
}


/* =========================================================
   ANALYZE BUTTON
========================================================= */

document
  .getElementById(
    "analyze"
  )
  .onclick =
    analyze;


/* =========================================================
   CLEAR HISTORY
========================================================= */

document
  .getElementById(
    "clearHistory"
  )
  .onclick = () => {

    if (
      confirm(
        "Clear all local MindGuard check-in history?"
      )
    ) {

      localStorage.removeItem(
        "mindguard_history"
      );


      renderHistory();
    }
  };


/* =========================================================
   BREATHING EXERCISE
========================================================= */

document
  .getElementById(
    "breathingBtn"
  )
  .onclick = () => {

    alert(
      "60-second breathing:\n\n" +
      "Inhale slowly for 4 seconds.\n" +
      "Hold for 4 seconds.\n" +
      "Exhale slowly for 6 seconds.\n\n" +
      "Repeat for about 60 seconds."
    );
  };


/* =========================================================
   TRUSTED PERSON SUPPORT
========================================================= */

document
  .getElementById(
    "supportBtn"
  )
  .onclick = () => {

    alert(
      "Consider reaching out to someone you trust — a friend, family member, mentor, or another supportive person."
    );
  };


/* =========================================================
   INITIAL LOAD
========================================================= */

renderHistory();
/* =========================================================
   PHASE 5 — TRUSTED CONTACT + PRIVACY
========================================================= */

const CONTACT_KEY = "mindguard_trusted_contact";


function getTrustedContact() {
  try {
    return JSON.parse(
      localStorage.getItem(CONTACT_KEY) || "null"
    );
  } catch {
    return null;
  }
}


function saveTrustedContact(contact) {
  localStorage.setItem(
    CONTACT_KEY,
    JSON.stringify(contact)
  );
}


/* =========================================================
   DISPLAY SAVED CONTACT
========================================================= */

function renderTrustedContact() {

  const contact =
    getTrustedContact();

  const name =
    document.getElementById("contactName");

  const relation =
    document.getElementById("contactRelation");

  const phone =
    document.getElementById("contactPhone");

  const status =
    document.getElementById("contactStatus");

  const message =
    document.getElementById("contactMessage");


  if (
    !name ||
    !relation ||
    !phone ||
    !status ||
    !message
  ) {
    return;
  }


  if (contact) {

    name.value =
      contact.name || "";

    relation.value =
      contact.relation || "";

    phone.value =
      contact.phone || "";


    status.textContent =
      "🤝 Configured";


    message.textContent =
      `${contact.name || "Trusted person"} ` +
      `(${contact.relation || "support contact"}) ` +
      `is saved locally.`;

  } else {

    name.value = "";

    relation.value = "";

    phone.value = "";


    status.textContent =
      "🔒 Private";


    message.textContent =
      "No trusted contact configured.";
  }
}


/* =========================================================
   SAVE TRUSTED CONTACT
========================================================= */

const saveContact =
  document.getElementById(
    "saveContact"
  );


if (saveContact) {

  saveContact.onclick = () => {

    const name =
      document
        .getElementById("contactName")
        .value
        .trim();


    const relation =
      document
        .getElementById("contactRelation")
        .value
        .trim();


    const phone =
      document
        .getElementById("contactPhone")
        .value
        .trim();


    if (!name || !phone) {

      alert(
        "Please enter the trusted person's name and phone number."
      );

      return;
    }


    saveTrustedContact({

      name:
        name,

      relation:
        relation,

      phone:
        phone

    });


    renderTrustedContact();


    const privacyMessage =
      document.getElementById(
        "privacyMessage"
      );


    if (privacyMessage) {

      privacyMessage.textContent =
        "Trusted contact saved locally in this browser. Nothing was uploaded.";
    }


    alert(
      "Trusted contact saved successfully."
    );
  };
}


/* =========================================================
   CONTACT TRUSTED PERSON
========================================================= */

const contactTrusted =
  document.getElementById(
    "contactTrusted"
  );


if (contactTrusted) {

  contactTrusted.onclick = () => {

    const contact =
      getTrustedContact();


    if (!contact) {

      alert(
        "Please save a trusted contact first."
      );

      return;
    }


    let phone =
      String(
        contact.phone || ""
      ).replace(
        /[^\d+]/g,
        ""
      );


    if (!phone) {

      alert(
        "The saved contact does not have a valid phone number."
      );

      return;
    }


    /*
      WhatsApp requires country code.
      Example India: +91XXXXXXXXXX
    */

    phone =
      phone.replace(
        "+",
        ""
      );


    const message =
      "Hi, I could use someone to talk to. Can you check in with me?";


    const whatsappURL =
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;


    window.open(
      whatsappURL,
      "_blank"
    );
  };
}


/* =========================================================
   REMOVE TRUSTED CONTACT
========================================================= */

const removeContact =
  document.getElementById(
    "removeContact"
  );


if (removeContact) {

  removeContact.onclick = () => {

    const contact =
      getTrustedContact();


    if (!contact) {

      alert(
        "No trusted contact is currently saved."
      );

      return;
    }


    const confirmed =
      confirm(
        "Remove the saved trusted contact?"
      );


    if (!confirmed) {
      return;
    }


    localStorage.removeItem(
      CONTACT_KEY
    );


    renderTrustedContact();


    const privacyMessage =
      document.getElementById(
        "privacyMessage"
      );


    if (privacyMessage) {

      privacyMessage.textContent =
        "Trusted contact removed from this browser.";
    }
  };
}


/* =========================================================
   CLEAR ALL LOCAL DATA
========================================================= */

const clearAllData =
  document.getElementById(
    "clearAllData"
  );


if (clearAllData) {

  clearAllData.onclick = () => {

    const confirmed =
      confirm(
        "This will permanently remove MindGuard's local check-in history and trusted contact from this browser. Continue?"
      );


    if (!confirmed) {
      return;
    }


    localStorage.removeItem(
      "mindguard_history"
    );


    localStorage.removeItem(
      CONTACT_KEY
    );


    renderTrustedContact();


    if (
      typeof renderHistory ===
      "function"
    ) {

      renderHistory();
    }


    const privacyMessage =
      document.getElementById(
        "privacyMessage"
      );


    if (privacyMessage) {

      privacyMessage.textContent =
        "All MindGuard local data has been cleared from this browser.";
    }


    const message =
      document.getElementById(
        "message"
      );


    if (message) {
      message.value = "";
    }


    const score =
      document.getElementById(
        "score"
      );


    if (score) {
      score.textContent = "—";
    }


    const textEmotion =
      document.getElementById(
        "textEmotion"
      );


    if (textEmotion) {
      textEmotion.textContent = "—";
    }


    const faceEmotion =
      document.getElementById(
        "faceEmotion"
      );


    if (faceEmotion) {
      faceEmotion.textContent = "—";
    }


    const suggestion =
      document.getElementById(
        "suggestion"
      );


    if (suggestion) {

      suggestion.textContent =
        "Your personalized suggestion will appear here.";
    }


    alert(
      "All local MindGuard data has been cleared."
    );
  };
}


/* =========================================================
   HIGH / CRITICAL SUPPORT PROMPT
========================================================= */

function checkTrustedContactSupport() {

  const history =
    typeof getHistory ===
    "function"
      ? getHistory()
      : [];


  const contact =
    getTrustedContact();


  if (
    !contact ||
    !history.length ||
    typeof calculateSafety !==
      "function"
  ) {

    return;
  }


  const safety =
    calculateSafety(
      history
    );


  if (

    (
      safety.level === "High" ||
      safety.level === "Critical"
    )

    &&

    !sessionStorage.getItem(
      "mindguard_support_prompted"
    )

  ) {

    sessionStorage.setItem(
      "mindguard_support_prompted",
      "1"
    );


    const shouldContact =
      confirm(

        `${safety.level} safety signal detected.\n\n` +

        `Would you like to open your saved trusted person's WhatsApp contact?`

      );


    if (!shouldContact) {
      return;
    }


    let phone =
      String(
        contact.phone || ""
      ).replace(
        /[^\d+]/g,
        ""
      );


    if (!phone) {
      return;
    }


    phone =
      phone.replace(
        "+",
        ""
      );


    const message =
      "Hi, I could use someone to talk to. Can you check in with me?";


    const whatsappURL =
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;


    window.open(
      whatsappURL,
      "_blank"
    );
  }
}


/* =========================================================
   INITIALIZE PHASE 5
========================================================= */

renderTrustedContact();


setTimeout(
  checkTrustedContactSupport,
  500
);