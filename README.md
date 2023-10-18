# Eris the Bot

Telegram bot for generating images from text.

## Requirements

- [Deno](https://deno.land/)
- [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui/)

## Options

You can put these in `.env` file or pass them as environment variables.

- `TG_BOT_TOKEN` - Telegram bot token. Get yours from [@BotFather](https://t.me/BotFather).
  Required.
- `TG_ADMIN_USERNAMES` - Comma separated list of usernames of users that can use admin commands.
- `DENO_KV_PATH` - [Deno KV](https://deno.land/api?s=Deno.openKv&unstable) database file path. A
  temporary file is used by default.
- `LOG_LEVEL` - [Log level](https://deno.land/std@0.201.0/log/mod.ts?s=LogLevels). Default: `INFO`.

You can configure more stuff in [Eris WebUI](http://localhost:5999/) when running.

## Running

- Start Stable Diffusion WebUI: `./webui.sh --api` (in SD WebUI directory)
- Start Eris: `deno task start`

## Codegen

The Stable Diffusion API types are auto-generated. To regenerate them, first start your SD WebUI
with `--nowebui --api`, and then run `deno task generate`

## Project structure

- `/api` - Eris API served at `http://localhost:5999/api/`.
- `/app` - Queue handling and other core processes.
- `/bot` - Handling bot commands and other updates from Telegram API.
- `/ui` - Eris WebUI frontend files served at `http://localhost:5999/`.
- `/util` - Utility functions shared by other parts.
