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

## TODO

- [x] Keep generation history
- [x] Changing params, parsing png info in request
- [x] Cancelling jobs by deleting message
- [x] Multiple parallel workers
- [ ] Replying to another text message to copy prompt and generate
- [ ] Replying to bot message, conversation in DMs
- [ ] Replying to png message to extract png info nad generate
- [ ] Banning tags
- [ ] Img2Img + Upscale
- [ ] Admin WebUI
- [ ] User daily generation limits
- [ ] Querying all generation history, displaying stats
- [ ] Analyzing prompt quality based on tag csv
- [ ] Report aliased/unknown tags based on csv
- [ ] Report unknown loras
- [ ] Investigate "sendMediaGroup failed"
- [ ] Changing sampler without error on unknown sampler
- [ ] Changing model
- [ ] Inpaint using telegram photo edit
- [ ] Outpaint
- [ ] Non-SD (extras) upscale
- [ ] Tiled generation to allow very big images
- [ ] Downloading raw images
- [ ] Extra prompt syntax, fixing `()+++` syntax
- [ ] Translations
  - replace fmtDuration usage
  - replace formatOrdinal usage
