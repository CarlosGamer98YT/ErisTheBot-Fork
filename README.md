# Eris the Bot

Telegram bot for generating images from text.

## Requirements

- [Deno](https://deno.land/)
- [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui/)

## Options

You can put these in `.env` file or pass them as environment variables.

- `TG_BOT_TOKEN` - Telegram bot token. Get yours from [@BotFather](https://t.me/BotFather).
  Required.
- `SD_API_URL` - URL to Stable Diffusion API. Only used on first run. Default:
  `http://127.0.0.1:7860/`
- `TG_ADMIN_USERS` - Comma separated list of usernames of users that can use admin commands. Only
  used on first run. Optional.

## Running

- Start stable diffusion webui: `cd sd-webui`, `./webui.sh --api`
- Start bot: `deno task start`
