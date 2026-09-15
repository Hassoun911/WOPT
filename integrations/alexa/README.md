# Hassoun Alexa integration

Hassoun supports voice Q&A, an Echo Show prayer dashboard, a Next Prayer widget, explicit next-prayer reminders, optional Hassoun account linking, saved prayer locations, and per-Echo location assignment.

## Current status

### Working in code / development testing

- Worker endpoint: `GET /voice/alexa/context`
- Passwordless Hassoun voice profiles with email verification
- Alexa OAuth authorization-code + refresh-token service
- Saved prayer locations
- Per-Echo location assignment after an Echo checks in through a linked account
- Privacy-safe hashed Alexa user/device identifiers
- English (US) and English (Canada) interaction models
- Prayer-time voice questions and natural variants such as `fajar`
- Echo Show APL prayer dashboard and live countdown
- Five prayer cards, Hijri date, location and next Islamic event
- Hassoun Next Prayer widget package
- Explicit 10-minute, 5-minute and prayer-time reminders when requested

### Amazon-side steps still required

- Configure Alexa Account Linking with the Hassoun OAuth URLs below
- Upload/deploy the latest packaged Lambda ZIP so access tokens and Echo IDs reach Hassoun
- Add widget Data Store credentials to Lambda if widget refresh is required
- Submit/certify the skill before public availability
- Smart Adhan TV/speaker/light routines require a separately approved Alexa smart-home/routine capability

## Architecture

`Alexa -> linked Lambda wrapper -> Hassoun Worker -> linked account/Echo location -> prayer context`

Unlinked legacy requests continue to use Windsor for backward compatibility. Linked requests use the Echo's assigned Hassoun location; if an Echo has no explicit assignment, Hassoun uses that account's default saved location.

## Hassoun account-linking service

Authorization URL:

`https://wopt-prayer-push.wopt-windsor.workers.dev/oauth/alexa/authorize`

Token URL:

`https://wopt-prayer-push.wopt-windsor.workers.dev/oauth/alexa/token`

Client ID:

`hassoun-alexa`

Scope:

`voice_profile`

Grant type: Authorization Code. Client authentication: HTTP Basic. Hassoun issues one-hour access tokens and rotating refresh tokens.

Create one strong random account-linking client secret. Store the SAME value in:

1. GitHub Actions repository secret `ALEXA_ACCOUNT_LINK_CLIENT_SECRET` (the Worker deploy workflow installs it as a Cloudflare Worker secret), and
2. Alexa Developer Console > Build > Account Linking > Client Secret.

Never commit or paste this secret into source code, issue comments, screenshots, or chat.

Hassoun's login flow is passwordless: the customer enters an email, receives a six-digit code through the existing Resend configuration, then Alexa receives an authorization code and exchanges it for Hassoun access/refresh tokens.

The customer can manage saved prayer locations and Echo assignments at:

`https://hassoun.app/voice-assistants/`

## Lambda deployment

Function name: `HassounAlexaSkill`

ARN:

`arn:aws:lambda:us-east-1:036325003024:function:HassounAlexaSkill`

Runtime: Node.js 24.x.

Do not upload only the raw repository `index.mjs` anymore. Download the `hassoun-alexa-integration` Actions artifact and upload `hassoun-alexa-lambda.zip` to Lambda. The ZIP contains:

- `index.mjs` — linked-request wrapper
- `base.mjs` — the proven voice/APL/widget/reminder handler

The wrapper forwards Alexa's linked access token and privacy-safe user/device identifiers to Hassoun for location resolution.

### Lambda environment variables for widget updates

The account-linked prayer context itself does not use the widget client credentials. Fresh Alexa Data Store widget writes do.

Add the Alexa skill client credentials to Lambda as:

- `ALEXA_SKILL_CLIENT_ID`
- `ALEXA_SKILL_CLIENT_SECRET`

These are Alexa skill service credentials and are **different** from `ALEXA_ACCOUNT_LINK_CLIENT_SECRET`.

## Alexa Developer Console

Skill ID:

`amzn1.ask.skill.fc9c1fb4-ddd2-4f27-b71f-a205d6a6b55c`

### Account Linking

Use:

- Authorization Grant Type: **Auth Code Grant**
- Authorization URI: `https://wopt-prayer-push.wopt-windsor.workers.dev/oauth/alexa/authorize`
- Access Token URI: `https://wopt-prayer-push.wopt-windsor.workers.dev/oauth/alexa/token`
- Client ID: `hassoun-alexa`
- Client Secret: the protected value shared with the Worker
- Client Authentication Scheme: **HTTP Basic**
- Scope: `voice_profile`

Use the Alexa redirect URLs shown by the Developer Console. The Hassoun OAuth service accepts Amazon's North America, Europe and Far East skill-link redirect hosts.

### Interaction model and interfaces

In Build > Interaction Model > JSON Editor, use:

- `skill-package/interactionModels/custom/en-US.json`
- `skill-package/interactionModels/custom/en-CA.json`

Enable:

- Alexa Presentation Language
- Data Store
- Data Store Packages
- APL Data Store Extension
- Reminders permission

Privacy policy:

`https://hassoun.app/privacy/`

Terms:

`https://hassoun.app/terms/`

## Per-Echo prayer locations

After account linking is enabled and the latest Lambda ZIP is deployed:

1. Link the Alexa skill to a Hassoun email profile.
2. Open Hassoun once on each Echo. The Echo will register itself using hashed Alexa identifiers.
3. Open `https://hassoun.app/voice-assistants/` and sign in with the same email code flow.
4. Add locations such as Home, Office or Parents.
5. Assign each detected Echo to a saved location.

Future prayer questions from that Echo use its selected coordinates, timezone, calculation method and madhab. If no explicit device assignment exists, the account default location is used.

## Echo Show experience

Say **Alexa, open Hassoun** to show the Hassoun prayer dashboard on supported APL devices. It includes the current linked/default location, Gregorian/Hijri dates, next prayer, live countdown, five prayer cards and next Islamic event.

## Next Prayer widget

The widget package is under:

`skill-package/dataStorePackages/HassounPrayerWidget/`

Namespace/key:

- Namespace: `HassounPrayer`
- Key: `main`

The Lambda sends upcoming prayer occurrences to Alexa Data Store when the Alexa skill service credentials are configured.

## Prayer reminders

`SetNextPrayerAlertsIntent` creates reminders only after a direct user request. Hassoun attempts 10 minutes before, 5 minutes before and prayer time, skipping times already passed. Users must grant Alexa Reminders permission.

## Smart Adhan automations

TV muting, speaker-volume changes, lights and automatic state restoration are not part of the ordinary custom-skill prayer flow. They require an Amazon-approved smart-home/routine capability. Keep these features labeled as planned until the Amazon-side capability is approved and configured.

## Google Home

Google Home remains a separate future integration and is not live.

## Packaging and validation

`.github/workflows/alexa-integration.yml` validates the interaction models, Lambda files, widget package, live Hassoun Worker endpoint, Echo Show launch response and a natural Fajar countdown request. It packages:

- `hassoun-alexa-lambda.zip`
- `hassoun-alexa-skill-package.zip`
