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
- `LOG_LEVEL` - [Log level](https://deno.land/std@0.201.0/log/mod.ts?s=LogLevels). Default: `INFO`.

## Running

- Start stable diffusion webui: `cd sd-webui`, `./webui.sh --api`
- Start bot: `deno task start`

To connect your SD to the bot, open the [Eris UI](http://localhost:5999/), login as admin and add a
worker.

## Codegen

The Stable Diffusion API in `app/sdApi.ts` is auto-generated. To regenerate it, first start your SD
WebUI with `--nowebui --api`, and then run:

```sh
deno run npm:openapi-typescript http://localhost:7861/openapi.json -o app/sdApi.ts
```
