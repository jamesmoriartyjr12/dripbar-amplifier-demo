# The DRIPBaR × Amplifier Health — customer demo

A mobile-first web demo of the journey a customer takes after tapping a Sunday-morning Facebook ad: a quick safety check, a voice (or typed) check-in, one better follow-up question, products recommended for them that a clinician confirms at the visit, and a simulated booking.

It opens in **demo mode**, which needs no credentials. **Tap to talk** asks for consent, then records about 20 seconds from the real microphone, with a live timer and a waveform driven by the mic level. The audio never leaves the device and is discarded when recording stops, and the result shown is labeled as simulated. If there's no microphone or permission is denied, the same recording screen plays with a simulated waveform, labeled as such. **Use demo sample** and **Type instead** remain as secondary options. Appointments, prices shown as local list prices, and the booking are all labeled as samples or simulated.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. On a laptop the demo renders inside a phone frame; on a phone it fills the screen. To try it on a phone, use `npm run dev -- -H 0.0.0.0` and open `http://<laptop-ip>:3000` on the same network.

```bash
npm test          # unit tests: adapter (mocked responses), journey logic, WAV encoding
npm run typecheck
npm run lint
```

## Hidden demo switches

Nothing presenter-facing appears in the customer UI. Use URL parameters instead:

| URL | What happens |
| --- | --- |
| `/` | Fatigue sample (the scripted walkthrough) |
| `/?scenario=dehydration` · `stress` · `anxiety` · `mood-disruption` | That sign's sample result at level `consider` |
| `/?scenario=unsuitable` | Sample with a background-noise issue, falls back to the standard questions |
| `/?scenario=timeout` | Sample that times out, falls back to the standard questions |
| `/?scenario=typed` | Typed intake only (no voice step) |
| `/?live=1` | Offers real recording when live analysis is configured (below) |

The footer **Restart** link (and **Start over** on the confirmation) resets the walkthrough.

Each sign's usable result promotes one plain-language question to the top. Thirst and nausea are asked in every path.

| Sign (`/v2/signs/{sign}/analyze`) | Promoted question |
| --- | --- |
| `fatigue` | Is low energy one of your main concerns today? |
| `dehydration` | Are you feeling thirsty or dried out? (the existing thirst question moves up) |
| `stress` | Have you been feeling stressed or stretched thin lately? |
| `anxiety` | Have you been feeling tense or unsettled lately? |
| `mood-disruption` | Have you been feeling low or run down lately? |

Customer copy never names a sign or says the voice found anything. Recommendations quote only the customer's own answers.

## Optional: live Amplifier analysis

1. Copy `.env.example` to `.env.local` and set `AMPLIFIER_ACCOUNT_ID` and `AMPLIFIER_API_KEY` (server-only).
2. Restart `npm run dev` and open `http://localhost:3000/?live=1`. The badge switches to **Live analysis on**, and **Tap to talk** sends the recording to Amplifier instead of showing the simulated result.
3. The customer sees a consent screen before the microphone opens or any audio leaves the device.

How it works:

- The browser records about 20 seconds (15 seconds minimum), encodes mono 16 kHz WAV, then stops the microphone and drops the samples.
- `POST /api/amplifier/analyze` forwards the file as multipart `audio` to `POST /v2/signs/{sign}/analyze`, with `X-Account-ID` and `X-API-Key` added on the server.
- The browser polls `GET /api/amplifier/jobs/{id}` (a proxy for `GET /v2/jobs/{job_id}`) every 3 seconds and gives up after 45 seconds.
- The server reads `result.signal.level` and `result.audio_quality.issues`. It returns only an interpreted outcome, never raw scores or narratives. Audio and payloads are not logged.
- Microphone denial, poor audio, bad credentials, failed or timed-out jobs, and the wait limit all fall back to the standard questions, showing the real status. A **Use the demo sample instead** link switches back to the labeled sample.

Access is limited to the presenter. Without `DEMO_PRESENTER_KEY`, live routes answer only requests addressed to `localhost` from a loopback client. With it set, requests must send the key: open the demo once with `?live=1&key=<value>`, and the key moves to session storage and is removed from the URL. Each server process allows 12 uploads and 200 polls per 15 minutes, and uploads are capped at 3 MB.

**Without credentials:** `node scripts/mock-amplifier.mjs 4010` runs a local stand-in. Start the app with `AMPLIFIER_ACCOUNT_ID=x AMPLIFIER_API_KEY=mock-good AMPLIFIER_BASE_URL=http://localhost:4010 npm run dev`. The API keys `mock-bad-key`, `mock-noisy`, `mock-failed` and `mock-slow` exercise the failure routes.

Reference: [Quickstart](https://docs.amplifierhealth.com/guides/quickstart/) · [Audio requirements](https://docs.amplifierhealth.com/guides/audio-requirements/) · [Interpreting results](https://docs.amplifierhealth.com/guides/interpreting-results/)

## 75-second demo script

Open `http://localhost:3000` (fatigue sample). Hold the phone, or present the laptop's phone frame.

1. **The ad (0:00).** "Sunday morning, someone taps our Facebook ad: *Feeling rough this morning?* They see a real local price, 100% Hydration at $109, subject to clinician assessment." Tap **Check today's times** and pick **11:40 a.m.**, the labeled sample appointment. "They choose a time, not a drip."
2. **Safety first (0:12).** "Before any recording or selling, four safety questions." Answer Yes, No, No, No and tap **Continue to voice check-in**. *(Optional aside: answering Yes to the last question ends the demo at "In a real emergency, call 911.")*
3. **Voice check-in (0:22).** "*Tell us how you're feeling this morning*, by voice or by typing." Tap the orb (**Tap to talk**), agree on the consent screen, and speak for a few seconds; the waveform follows your voice. Tap **Stop**. "The audio is discarded on the spot; in demo mode the result is simulated and labeled that way. Then a short thinking state." *(No mic in the room? The same screen plays with a simulated waveform. **Use demo sample** gives the scripted 5-second version.)*
4. **One better question (0:35).** "The voice result moved one question to the top: *Is low energy one of your main concerns today?* The customer still decides." Tap **Yes**, then thirst **Yes** and nausea **No**. Tap **See my options**.
5. **Recommended for you (0:48).** "Powerpack ($224) leads because they said low energy is a main concern, with 100% Hydration ($109) next to it. Evolve membership and Oral Supplements appear for between visits. Every option is framed as *a clinician confirms at your visit*." Tap **I'm interested** on Powerpack, then **Book my visit**.
6. **Booked (1:00).** Tap **Request 11:40 a.m.** "A simulated confirmation, with no appointment or charge. It carries their answers: *Can keep fluids down. Main concerns are thirst and low energy.*"
7. **Close (1:10).** "Swap the sample for a live Amplifier analysis and the same flow runs on the customer's real voice." Tap **Start over**.
