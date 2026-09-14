# Hassoun Alexa integration

This folder contains the production-ready first version of the Hassoun Alexa Custom Skill.

## What is already built

- Hassoun Worker endpoint: `GET /voice/alexa/context`
- Alexa Lambda handler: `integrations/alexa/lambda/index.mjs`
- Alexa interaction model for `en-CA`
- Alexa skill manifest template
- Windsor prayer times from the same Hassoun schedule backend
- Next prayer and countdown
- Individual prayer time lookup
- All five prayer times
- Hijri date
- Next Islamic event / holiday

## Architecture

Alexa -> AWS Lambda -> Hassoun Worker -> Hassoun prayer schedule

The Lambda reads from:

`https://wopt-prayer-push.wopt-windsor.workers.dev/voice/alexa/context`

Set `HASSOUN_API_BASE` in Lambda only if the Worker URL changes.

## Lambda

Create an AWS Lambda function named `hassoun-alexa` using Node.js 22.x. Upload `lambda/index.mjs` and set the handler to `index.handler`.

The Lambda requires no npm dependencies.

Add an Alexa Skills Kit trigger to the Lambda. Amazon will restrict invocation to the Skill ID after the skill is created.

## Alexa Developer Console

Create a Custom Skill named **Hassoun** with locale **English (Canada)**.

Import/copy:

- interaction model: `skill-package/interactionModels/custom/en-CA.json`
- publishing metadata: `skill-package/skill.json`

Set the Custom Skill endpoint to the ARN of the `hassoun-alexa` Lambda.

Recommended invocation name: `hassoun`.

## Supported phrases

- Alexa, ask Hassoun what the next prayer is.
- Alexa, ask Hassoun when Maghrib is.
- Alexa, ask Hassoun how long until Isha.
- Alexa, ask Hassoun for today's prayer times.
- Alexa, ask Hassoun what today's Hijri date is.
- Alexa, ask Hassoun what the next Islamic holiday is.

## Location/profile status

Version 1 uses Hassoun's official Windsor schedule, matching the current Hassoun Windsor experience. The Worker response includes location and time zone explicitly.

The next version can add Hassoun account linking so each Alexa household uses the location/profile saved in the Hassoun app. That requires an OAuth authorization service and Amazon account-linking configuration.

## Smart Adhan automations

The voice Q&A skill is independent from Alexa Routine triggers. Muting a TV or changing smart-home devices at Adhan requires an Alexa smart-home/routine integration or approved routine trigger. The app UI should not claim that automation is live until that Amazon-side capability is approved and configured.
