# Hassoun Alexa integration

Hassoun now supports voice Q&A, an Echo Show prayer dashboard, a Next Prayer widget, and explicit next-prayer reminders, all backed by the same Hassoun Windsor prayer schedule.

## What is built

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

## Architecture

`Alexa -> AWS Lambda -> Hassoun Worker -> Hassoun prayer schedule`

The Lambda reads from:

`https://wopt-prayer-push.wopt-windsor.workers.dev/voice/alexa/context`

Set `HASSOUN_API_BASE` in Lambda only if the Worker URL changes.

## Current production Lambda

Function name: `HassounAlexaSkill`

ARN:

`arn:aws:lambda:us-east-1:036325003024:function:HassounAlexaSkill`

Runtime: Node.js 24.x.

The Lambda has no npm dependencies. Replace the deployed `index.mjs` with the latest `integrations/alexa/lambda/index.mjs`, then click **Deploy** in AWS Lambda.

### Lambda environment variables for widget updates

The full-screen dashboard does not require additional credentials. The home-screen widget Data Store sync does.

Add these Lambda environment variables using the Alexa skill's client credentials:

- `ALEXA_SKILL_CLIENT_ID`
- `ALEXA_SKILL_CLIENT_SECRET`

The Lambda exchanges those credentials for a Login with Amazon access token with scope `alexa::datastore`, then writes the user's Hassoun prayer snapshot to the Alexa Data Store.

If these variables are not configured, voice Q&A and the full-screen APL dashboard still work, but the widget cannot receive fresh prayer data from the skill service.

## Alexa Developer Console setup

Skill ID:

`amzn1.ask.skill.fc9c1fb4-ddd2-4f27-b71f-a205d6a6b55c`

In **Build > Interaction Model > JSON Editor**, use the current locale model:

- English (US): `skill-package/interactionModels/custom/en-US.json`
- English (Canada): `skill-package/interactionModels/custom/en-CA.json`

Save and build the model after updating it.

In **Build > Interfaces**, enable and save the interfaces required by the package:

- Alexa Presentation Language
- Data Store
- Data Store Packages
- APL Data Store Extension

The manifest template in `skill-package/skill.json` contains the corresponding interfaces:

- `ALEXA_PRESENTATION_APL`
- `ALEXA_DATA_STORE`
- `ALEXA_DATASTORE_PACKAGEMANAGER`
- `ALEXA_EXTENSION` requesting `alexaext:datastore:10`

In **Build > Permissions**, enable **Reminders**. The manifest requests:

`alexa::alerts:reminders:skill:readwrite`

Users still must grant the permission on their own Alexa account. Hassoun only creates the three reminders after a direct user request to set next-prayer reminders.

## Echo Show full-screen experience

On a device that supports `Alexa.Presentation.APL`, saying:

**Alexa, open Hassoun**

returns an `Alexa.Presentation.APL.RenderDocument` directive and displays:

- Hassoun branding
- Windsor location
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
