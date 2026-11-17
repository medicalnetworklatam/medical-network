# Login setup in Supabase: emails, links and passwords

This folder has the Spanish emails that Supabase sends for logins. Below is
everything to set in the Supabase dashboard (project **mnl-client-area**)
so that logins work. Nothing here needs a key, and Claude Code never
connects to Supabase.

Supabase renames menus from time to time. If a name below doesn't match,
use the search box at the top of the dashboard, or look for the setting's
name on the page.

| File | Supabase template | Subject |
|---|---|---|
| `invite.html` | **Invite user** | `Tu invitación a Medical Network` |
| `reset-password.html` | **Reset password** | `Crea una contraseña nueva para Medical Network` |
| `confirm-signup.html` | **Confirm sign up** | `El registro en Medical Network no está abierto` |
| `magic-link.html` | **Magic link** | `Inicia sesión en Medical Network con tu contraseña` |
| `change-email.html` | **Change email address** | `Confirma el cambio de correo en Medical Network` |
| `reauthentication.html` | **Reauthentication** | `Tu código de confirmación de Medical Network` |
| `password-changed.html` | **Password changed** (notification) | `Tu contraseña de Medical Network ha cambiado` |
| `email-changed.html` | **Email address changed** (notification) | `El correo de tu cuenta de Medical Network ha cambiado` |
| `phone-changed.html` | **Phone number changed** (notification) | `El teléfono de tu cuenta de Medical Network ha cambiado` |
| `identity-linked.html` | **Identity linked** (notification) | `Nuevo método de acceso en tu cuenta de Medical Network` |
| `identity-unlinked.html` | **Identity unlinked** (notification) | `Método de acceso eliminado de tu cuenta de Medical Network` |
| `mfa-added.html` | **MFA method added** (notification) | `Nueva verificación en dos pasos en Medical Network` |
| `mfa-removed.html` | **MFA method removed** (notification) | `Verificación en dos pasos eliminada en Medical Network` |

Copy each subject exactly, accents included (á, é, í, ó, ú, ñ). All files are
saved as UTF-8, so the accents also arrive correctly in the email body.

---

## 1. Website settings in Cloudflare (once)

The website needs two **environment variables** (settings that live outside
the code):

| Name | Value (from Supabase → Project Settings → API Keys / Data API) |
|---|---|
| `VITE_SUPABASE_URL` | the project URL, `https://<something>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the **publishable** key (`sb_publishable_…`), or the older **anon** key |

1. Cloudflare dashboard → **Workers & Pages** → the project behind
   `medical-network-79g.pages.dev` → **Settings** → **Variables and
   Secrets** (in older dashboards: **Environment variables**).
2. Add both, for **Production** and for **Preview**. Type "Text" is fine:
   these two values are public by design.
3. **Redeploy.** The values are copied into the site when it's built, so a
   build made before you added them doesn't have them. Pushing a new commit
   also does it.

Never use the **secret** / service-role key here: everything named `VITE_…`
ends up readable in the browser.

**On your PC:** copy `.env.example` (in the project folder) to `.env.local`,
fill in the same two values, and restart `npm run dev`. Git never commits
`.env.local`.

## 2. URL Configuration (once)

**Authentication → URL Configuration**

**Site URL** (exactly this, with **no `/` at the end**):

```
https://medical-network-79g.pages.dev
```

**Redirect URLs**: click "Add URL" once for each line:

```
https://medical-network-79g.pages.dev/**
https://*.medical-network-79g.pages.dev/**
http://localhost:5173/**
http://localhost:4173/**
```

| Line | For |
|---|---|
| 1 | the live site (production) |
| 2 | every Cloudflare preview (each branch and each commit gets an address like `abc123.medical-network-79g.pages.dev`) |
| 3 | `npm run dev` on your PC |
| 4 | `npm run preview` on your PC |

**What these do:**
- **Redirect URLs** are the only addresses Supabase will send people back
  to from an email. Anything else is replaced by the Site URL.
- **Invite emails always go to the Site URL**, so to the live site. To try
  an invite, the login screens must be live first, so after this pull
  request is merged.
- **Reset emails ("¿Olvidaste tu contraseña?") go back to the site where the
  form was used:** the live site, a preview or your PC. So a reset can be
  tested on a Cloudflare preview.

**When a custom domain comes** (for example `app.medicalnetworklatam.com`):
change the Site URL to it, and add `https://app.medicalnetworklatam.com/**`
to the Redirect URLs.

## 3. Passwords and link lifetime (once)

**Authentication → Sign In / Providers → Email** (in older dashboards:
**Authentication → Providers → Email**):

- **Minimum password length: `8`.** The server then refuses shorter
  passwords, even if someone gets past the website's form. The form asks
  for at least 8 too.
- **Email OTP Expiration: `86400`** seconds, which is 24 hours. This is how
  long the links in the emails work. One setting covers both invite and
  reset links. The emails say "24 horas", so if you change this, change the
  emails too.
- Leave the other settings as they are.

Keep **"Allow new users to sign up"** off (see `supabase/README.md`).

## 4. Paste the email templates (once, and again after any change)

Supabase only lets you edit the templates once custom SMTP is set up
(Brevo, in **Authentication → Emails → SMTP Settings**). Before that, the
templates can't be changed.

**Authentication → Emails → Templates**:

1. Choose **Invite user**.
2. **Subject:** `Tu invitación a Medical Network`
3. **Body:** open `supabase/templates/invite.html` in the repository, copy
   **all** of it (on GitHub, the "Copy raw file" button) and paste it over
   the old text.
4. **Save.**
5. Do the same for **Reset password** with `reset-password.html` and the
   subject `Crea una contraseña nueva para Medical Network`.

**The other four templates, same tab, same way** (subjects in the table at
the top of this file):

6. **Confirm sign up** → `confirm-signup.html`. Sign-ups are off, so this
   should never be sent. It only says that sign-up is closed, with no link.
7. **Magic link** → `magic-link.html`. We don't offer login by email link.
   The email has no working link: it tells the person to log in with email
   and password at `/iniciar-sesion`.
8. **Change email address** → `change-email.html`. This one keeps Supabase's
   real confirmation link. With "Secure email change" on, Supabase sends it
   to both the old and the new address, and the change happens only after
   both are confirmed.
9. **Reauthentication** → `reauthentication.html`. It shows a one-time code
   (`{{ .Token }}`) instead of a link.

Note on **Change email address**: unlike our invite and reset links, this
is Supabase's standard link, which is used up the moment it's opened. If an
email scanner (Outlook, for example) opens it first, the person gets an
"expired link" error and has to ask for the change again.

**Security notifications.** These are info-only emails Supabase sends
*after* something changed. Each has its own on/off switch.

**Authentication → Emails → Security notifications** (if you can't find it,
search the dashboard for "Security notifications"; it may be a tab next to
**Templates**):

10. Open **Password changed**, switch it **ON**, paste `password-changed.html`,
    set the subject from the table, **Save**.
11. Do the same for **Email address changed** with `email-changed.html`,
    switched **ON**.
12. For **Phone number changed**, **Identity linked**, **Identity unlinked**,
    **MFA method added** and **MFA method removed**: paste the matching file
    and subject and **Save**, but leave the switch **OFF**.

Why: with the first two ON, a client learns at once if someone else changed
their password or login email, and can write to web@medicalnetworklatam.com.
We don't use phone numbers, other login methods (identities, like Google) or
two-step verification (MFA), so the other five would never have anything to
report. They're pasted anyway so that, if one is ever turned on, it's in
Spanish.

None of the notifications contain a link. They name
web@medicalnetworklatam.com as plain text (some email apps still make it
clickable on their own; that's fine, it only opens a new email).

The parts in `{{ … }}` are filled in by Supabase when it sends the email.
Keep them exactly as they are.

Why our own templates instead of Supabase's: Supabase's standard link logs
the person in the moment the link is opened. Some email programs, Outlook
for example, open every link by themselves to scan it, which would use up
the one-time link before the person sees it. Our link opens the "set your
password" screen, and the link is only used when the person presses
**Guardar contraseña**.

## 5. Who receives emails while testing

- **Supabase's built-in email sender is for testing only.** It only
  delivers to the email addresses of your Supabase project's **team
  members** (Organization → Team), and only a few emails per hour.
  - So for now, test with an address that's on the team, such as
    web@medicalnetworklatam.com.
- **Before inviting real clients,** connect Brevo:
  - where: **Authentication → Emails → SMTP Settings**
  - see DECISIONS.md, "Login emails go through Brevo"
- **If an email doesn't arrive:**
  - check the spam folder
  - look at **Authentication → Users**: an invited person shows as
    "Waiting for verification"

## 6. Quick test

**On a Cloudflare preview** (after step 1):
1. Open `…/novedades`. You should land on **Iniciar sesión**.
2. Log in with an existing account and password. You should land back on
   Novedades.
3. Press **Cerrar sesión** at the bottom of the green column. You should see
   "Tu sesión se ha cerrado."
4. Press **¿Olvidaste tu contraseña?**, send it to your own address, open
   the email and set a new password. The link should open the same preview
   address.

**After merging, on the live site:**
1. **Authentication → Users → Invite user** with an address on the team.
2. Open the email, press **Crear mi contraseña**, choose a password, then
   **Continuar**.

**If a reset link opens the home page instead of the password form,** the
address you used isn't in the Redirect URLs list (step 2).
