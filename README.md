# TIGORIX 1K Community Giveaway

Vercel + GitHub + Firebase Firestore + Telegram Bot API.

## What it does
- Telegram Mini App user authentication is validated server-side.
- Requires membership in `@Tigorix`.
- Collects a USDT BEP20 wallet address.
- One entry per Telegram ID, IP hash, device hash and wallet.
- Giveaway starts on the first `/api/status` call and runs for 5 hours.
- Randomly selects 10 eligible entries; each wins 0.1 USDT.
- Posts winner usernames and amounts to `@Tigorix`.
- Sends winner username, Telegram ID, amount and wallet address to admin chat `5767112472`.
- First button click opens the supplied promotion URL.

## Vercel Environment Variables
Create these in Vercel Project Settings → Environment Variables:

`TELEGRAM_BOT_TOKEN` = your @tigorixbot BotFather token
`ADMIN_CHAT_ID` = `5767112472`
`COMMUNITY_CHANNEL` = `@Tigorix`
`ANTI_ABUSE_PEPPER` = a long random secret string
`FIREBASE_SERVICE_ACCOUNT_JSON` = the complete Firebase service-account JSON on one line

Do NOT put the bot token in `index.html` or any `NEXT_PUBLIC_` variable.

## Firebase
1. Open Firebase Console → project `tigorix-giveaway`.
2. Enable Firestore.
3. Create a Firebase service account and download its JSON.
4. Put the complete JSON into the Vercel `FIREBASE_SERVICE_ACCOUNT_JSON` variable.
5. Keep Firestore rules as provided; the Vercel server uses Admin SDK.

## Telegram
Add `@tigorixbot` as an administrator of `@Tigorix` and allow it to post messages. The bot must be able to call `getChatMember` for membership verification.

## Deploy
1. Upload this folder to GitHub.
2. Import the repository into Vercel.
3. Add the environment variables above.
4. Deploy.
5. Set the GitHub repository secret `VERCEL_APP_URL` to your Vercel URL, for example `https://your-project.vercel.app`.
6. The included GitHub Action checks `/api/finish` every 5 minutes. It is a backup trigger; the server itself will never finish before the configured 5-hour end time.

## Important
The IP/device controls are anti-abuse measures, not an absolute guarantee against sophisticated multi-account abuse. Shared networks can legitimately have the same public IP. Review suspicious entries before sending funds.
