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
