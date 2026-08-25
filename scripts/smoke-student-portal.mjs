import process from "node:process";

const baseUrl = process.env.STUDENT_PORTAL_BASE_URL ?? "http://localhost:3000";
const studentNumber = process.env.STUDENT_PORTAL_NUMBER;
const pin = process.env.STUDENT_PORTAL_PIN;

if (!studentNumber || !pin) {
  throw new Error(
    "Set STUDENT_PORTAL_NUMBER and STUDENT_PORTAL_PIN before running this local smoke test."
  );
}

function decodeHtml(value = "") {
  return value.replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

async function getFormFields(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const html = await response.text();
  const fields = [];

  for (const match of html.matchAll(
    /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g
  )) {
    fields.push([decodeHtml(match[1]), decodeHtml(match[2])]);
  }

  return { html, fields };
}

async function submitLogin(candidatePin) {
  const page = await getFormFields("/student/login");
  const form = new FormData();

  for (const [name, value] of page.fields) {
    form.append(name, value);
  }

  form.append("student_number", studentNumber);
  form.append("pin", candidatePin);

  return fetch(`${baseUrl}/student/login`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
}

const invalid = await submitLogin(`${pin}0`);
const invalidBody = await invalid.text();
const valid = await submitLogin(pin);
const setCookie = valid.headers.get("set-cookie") ?? "";
const cookie = setCookie.split(";")[0];
const dashboard = await fetch(`${baseUrl}/student`, { headers: { cookie } });
const dashboardBody = await dashboard.text();
const protectedRoutes = [];

for (const route of ["attendance", "quizzes", "laboratories", "qr", "profile"]) {
  const response = await fetch(`${baseUrl}/student/${route}`, {
    headers: { cookie },
  });
  const body = await response.text();
  const heading =
    route === "qr" ? "My QR" : route.charAt(0).toUpperCase() + route.slice(1);

  protectedRoutes.push({
    route,
    status: response.status,
    hasHeading: body.includes(heading),
  });
}

const authenticatedLogin = await fetch(`${baseUrl}/student/login`, {
  headers: { cookie },
  redirect: "manual",
});
const authenticatedLoginBody = await authenticatedLogin.text();
const dashboardForm = await getFormFields("/student", cookie);
const logoutForm = new FormData();

for (const [name, value] of dashboardForm.fields) {
  logoutForm.append(name, value);
}

const logout = await fetch(`${baseUrl}/student`, {
  method: "POST",
  headers: { cookie },
  body: logoutForm,
  redirect: "manual",
});

console.log(
  JSON.stringify(
    {
      invalidLogin: {
        status: invalid.status,
        genericError: invalidBody.includes("Invalid student number or PIN."),
        createdCookie: Boolean(invalid.headers.get("set-cookie")),
      },
      validLogin: {
        status: valid.status,
        location: valid.headers.get("location"),
        httpOnly: /HttpOnly/i.test(setCookie),
        sameSiteLax: /SameSite=Lax/i.test(setCookie),
        studentCookiePath: /Path=\/student/i.test(setCookie),
      },
      dashboard: {
        status: dashboard.status,
        hasOwnStudentNumber: dashboardBody.includes(studentNumber),
        hasAttendance: dashboardBody.includes("Attendance"),
        hasQuizAverage: dashboardBody.includes("Quiz Average"),
        hasLaboratoryAverage: dashboardBody.includes("Laboratory Average"),
        hasRecentActivity: dashboardBody.includes("Recent activity"),
      },
      protectedRoutes,
      authenticatedLogin: {
        redirectsToStudent: authenticatedLoginBody.includes(
          "NEXT_REDIRECT;replace;/student"
        ),
      },
      logout: {
        status: logout.status,
        location: logout.headers.get("location"),
        clearsCookie: /Max-Age=0/i.test(logout.headers.get("set-cookie") ?? ""),
      },
    },
    null,
    2
  )
);
