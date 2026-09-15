# Hassoun Alexa integration

Hassoun supports voice Q&A, an Echo Show prayer dashboard, a Next Prayer widget, and explicit next-prayer reminders. The Alexa skill is working in development/testing. Amazon publication/certification and optional Hassoun account linking are separate remaining steps.

## Current status

### Working now in development/testing

- Worker endpoint: `GET /voice/alexa/context`
- Lambda handler: `integrations/alexa/lambda/index.mjs`
- English (US) and English (Canada) interaction models
- Prayer-time voice questions and natural variants such as `fajar`
- Echo Show APL dashboard shown when the user says **Alexa, open Hassoun**
- Live next-prayer countdown on the full-screen dashboard
- Five prayer cards, Hijri date, location and next Islamic event
- Focused visual countdown during the final five minutes
- `IT IS TIME TO PRAY` state when the countdown reaches zero while the dashboard is open
- Hassoun Next Prayer widget package for compatible Echo Show devices
- Widget tap launches the full Hassoun dashboard
- Widget stores upcoming prayer occurrences so it can advance the displayed next prayer using device time without polling every second
- Explicit 10-minute, 5-minute and prayer-time reminders for the next prayer when the user asks Hassoun to set them

### Still required for public/advanced setup

- Amazon skill certification/publication before the skill is public for everyone
- Hassoun account linking if we want saved Hassoun profiles to follow the user into Alexa
- Per-Echo device location/profile assignment
- Production smart-home/routine capability for TV muting, speaker volume, lights and state restoration
- Google Home integration is separate and is not live yet

Account linking is **not required** for the current development-skill voice Q&A and Echo Show experience. It becomes important when Hassoun needs to know which saved Hassoun profile/location belongs to which Alexa user or Echo device.

## Architecture

`Alexa -> AWS Lambda -> Hassoun Worker -> Hassoun prayer context`

The Lambda reads from:

`https://wopt-prayer-push.wopt-windsor.workers.dev/voice/alexa/context`

Set `HASSOUN_API_BASE` in Lambda only if the Worker URL changes.

The Worker supports location-aware prayer context when latitude/longitude/profile information is supplied. Alexa requests that do not yet supply a Hassoun profile/location continue to use the legacy Windsor default for compatibility. Do not describe Alexa as automatically worldwide per device until the account/device-location layer is connected.

## Current production Lambda

Function name: `HassounAlexaSkill`

ARN:

`arn:aws:lambda:us-east-1:036325003024:function:HassounAlexaSkill`

Runtime: Node.js 24.x.

The Lambda has no npm dependencies. Replace the deployed `index.mjs` with the latest `integrations/alexa/lambda/index.mjs`, then click **Deploy** in AWS Lambda whenever the Lambda source changes.

### Lambda environment variables for widget updates

The full-screen dashboard does not require additional credentials. The home-screen widget Data Store sync does.

Add these Lambda environment variables using the Alexa skill's client credentials:

- `ALEXA_SKILL_CLIENT_ID`
- `ALEXA_SKILL_CLIENT_SECRET`

The Lambda exchanges those credentials for a Login with Amazon access token with scope `alexa::datastore`, then writes the user's Hassoun prayer snapshot to the Alexa Data Store.

If these variables are not configured, voice Q&A and the full-screen APL dashboard still work, but the widget cannot receive fresh prayer data from the skill service.

Do not put these credentials in GitHub or chat. Store them only in the Lambda environment/secrets configuration.

## Alexa Developer Console setup

Skill ID:

`amzn1.ask.skill.fc9c1fb4-ddd2-4f27-b71f-a205d6a6b55c`

In **Build > Interaction Model > JSON Editor**, use the current locale model:

- English (US): `skill-package/interactionModels/custom/en-US.json`
- English (Canada): `skill-package/interactionModels/custom/en-CA.json`

Save and build the model after updating it.

In **Build > Interfaces**, enable and save:

- Alexa Presentation Language
- Data Store
- Data Store Packages
- APL Data Store Extension

The manifest template in `skill-package/skill.json` contains:

- `ALEXA_PRESENTATION_APL`
- `ALEXA_DATA_STORE`
- `ALEXA_DATASTORE_PACKAGEMANAGER`
- `ALEXA_EXTENSION` requesting `alexaext:datastore:10`

In **Build > Permissions**, enable **Reminders**. The manifest requests:

`alexa::alerts:reminders:skill:readwrite`

Users still must grant the permission on their own Alexa account. Hassoun only creates the three reminders after a direct user request to set next-prayer reminders.

## What the owner still needs to do

1. Keep the Alexa Developer Console skill in Development while testing the current Hassoun experience.
2. When ready for public use, complete the Amazon **Distribution / Privacy / Certification / Submission** flow and submit the skill for certification.
3. If the Next Prayer widget should receive fresh Data Store updates, add `ALEXA_SKILL_CLIENT_ID` and `ALEXA_SKILL_CLIENT_SECRET` to the AWS Lambda environment using the Alexa skill's client credentials.
4. When Hassoun account linking is implemented, configure the Alexa **Account Linking** section with the Hassoun OAuth authorization/token endpoints and client credentials. Do not configure placeholder URLs.
5. Smart Adhan TV/speaker/light automations require their own approved smart-home/routine capability; they are not part of the current working custom skill.

## Echo Show full-screen experience

On a device that supports `Alexa.Presentation.APL`, saying:

**Alexa, open Hassoun**

returns an `Alexa.Presentation.APL.RenderDocument` directive and displays:

- Hassoun branding
- current configured/default location
- Gregorian date
- Hijri date
- next prayer name
- next prayer time
- live countdown
- Fajr, Dhuhr, Asr, Maghrib and Isha cards
- next Islamic event

The countdown uses the APL `utcTime` value on the device, so it continues to tick on screen after the Lambda response is returned.

## Hassoun Next Prayer widget

Widget package:

`skill-package/dataStorePackages/HassounPrayerWidget/`

The widget uses the Data Store namespace/key:

- Namespace: `HassounPrayer`
- Key: `main`

The Lambda sends an ordered list of upcoming prayer occurrences. The widget compares each target time with device `utcTime`, so after one prayer passes it can automatically show the next stored prayer without needing a per-second server update.

Tapping the widget sends a standard widget `SendEvent` and opens the full Hassoun dashboard.

On Echo Show 15 the widget can remain in the Widget Panel. Other compatible Echo Show devices expose widgets through their supported widget surfaces/shortcuts.

### Widget Gallery artwork before certification

The package currently uses the Hassoun app icon as development placeholder artwork. Before Amazon certification, replace it with dedicated widget assets that meet Amazon's Widget Gallery image dimensions and artwork rules, including the required widget icon and preview image.

## Prayer reminders

The intent `SetNextPrayerAlertsIntent` supports phrases such as:

- Alexa, ask Hassoun to set prayer reminders.
- Alexa, ask Hassoun to remind me before the next prayer.
- Alexa, ask Hassoun to alert me ten and five minutes before the next prayer.

For the current next prayer, Hassoun attempts to create:

- 10 minutes before
- 5 minutes before
- at the prayer time

If a reminder time has already passed, that reminder is skipped. Alexa permission is requested if the user has not granted Reminders access.

These are explicit reminders created after the user asks. They are not yet a background enrollment that silently schedules every prayer every day.

## Voice examples

- Alexa, open Hassoun.
- Alexa, ask Hassoun what the next prayer is.
- Alexa, ask Hassoun when Maghrib is.
- Alexa, ask Hassoun how long until Isha.
- Alexa, ask Hassoun how much time is left for Fajar.
- Alexa, ask Hassoun for today's prayer times.
- Alexa, ask Hassoun what today's Hijri date is.
- Alexa, ask Hassoun what the next Islamic holiday is.
- Alexa, ask Hassoun to show the prayer dashboard.

## Smart-home Adhan automations

The prayer dashboard/widget/reminder work is separate from smart-home control. Muting a TV, lowering a speaker, changing lights, or restoring their previous state at Adhan requires an Alexa smart-home/routine integration or an approved routine trigger. Do not present those actions as live until the Amazon-side smart-home capability is configured and approved.

## Packaging and validation

`.github/workflows/alexa-integration.yml` validates both interaction models, the Lambda syntax, the widget package JSON/TPL, the live Hassoun Worker endpoint, an Echo Show launch response, and the natural `fajar` countdown phrase. It then packages:

- `hassoun-alexa-lambda.zip`
- `hassoun-alexa-skill-package.zip`
