import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.135.0/testing/asserts.ts";
import { parsePngInfo } from "./sd.ts";

Deno.test("parses pnginfo", async (t) => {
  await t.step("1", () => {
    const params = parsePngInfo(
      `female, red fox, pink hair, (long hair), eyeshadow, lipstick, armband, midriff, leather shorts, (fishnet) legwear, fingerless gloves, <3, tongue out, 
      presenting breasts, ((flashing)) breasts, shirt lift, raised shirt, public exposure, 
      lgbt pride, pride colors, pride color clothing, flag \\(object\\), pride march, public, 
      braeburned, keadonger, zaush, jishinu, pixelsketcher, detailed background, insane detail, soft shading, masterpiece
      Negative prompt:  bad-hands-5, boring_e621
      Steps: 40, Sampler: Euler a, CFG scale: 8, Seed: 2843818575, Size: 768x768, Model hash: e2d72a81a3, Model: bb95FurryMix_v90, Denoising strength: 0.28,
      SD upscale overlap: 64, SD upscale upscaler: Lanczos, Version: v1.4.0`,
    );
    assertMatch(params.prompt ?? "", /\blong hair\b/);
    assertMatch(params.prompt ?? "", /\bflag \\\(object\\\)/);
    assertMatch(params.prompt ?? "", /\bmasterpiece\b/);
    assert(!params.prompt?.includes("2843818575"));
    assertMatch(params.negative_prompt ?? "", /\bbad-hands-5\b/);
    assertMatch(params.negative_prompt ?? "", /\bboring_e621\b/);
    assert(!params.negative_prompt?.includes("2843818575"));
    assertEquals(params.steps, 40);
    assertEquals(params.cfg_scale, 8);
    assertEquals(params.width, 768);
    assertEquals(params.height, 768);
  });

  await t.step("2", () => {
    const params = parsePngInfo(
      `anthro, female, wolf:1.2, long hair, fluffy tail, thick thighs, 
      wraps, loincloth, tribal clothing, tribal body markings, bone necklace, feathers in hair, skimpy, 
      holding spear, weapon, crouching, digitigrade, action pose, perspective, motion lines, forest, hunting, female pred, grin, angry,
      by kenket, by ruaidri, by keadonger, by braeburned, by twiren, detailed fur, hires, masterpiece, <lora:add_detail:0.8>
      Negative prompt: boring_e621_fluffyrock
      Steps: 40, Sampler: Euler a, CFG scale: 7, Seed: 2876880391, Size: 1536x1536, Model hash: 06ac6055bd,
      Model: fluffyrock-576-704-832-960-1088-lion-low-lr-e61-terminal-snr-e34, Denoising strength: 0.2, 
      Ultimate SD upscale upscaler: None, Ultimate SD upscale tile_width: 768, Ultimate SD upscale tile_height: 768, 
      Ultimate SD upscale mask_blur: 8, Ultimate SD upscale padding: 48, 
      Lora hashes: "add_detail: 7c6bad76eb54", Version: v1.3.2`,
    );
    assertMatch(params.prompt ?? "", /\bwolf\b/);
    assertMatch(params.prompt ?? "", /\bdigitigrade\b/);
    assertMatch(params.prompt ?? "", /\bby ruaidri\b/);
    assert(!params.prompt?.includes("7c6bad76eb54"));
    assert(!params.prompt?.includes("tile_width"));
    assert(!params.prompt?.includes("boring_e621_fluffyrock"));
    assertMatch(params.negative_prompt ?? "", /\bboring_e621_fluffyrock\b/);
    assert(!params.negative_prompt?.includes("7c6bad76eb54"));
    assert(!params.negative_prompt?.includes("tile_width"));
    assert(!params.negative_prompt?.includes("add_detail"));
    assertEquals(params.steps, 40);
    assertEquals(params.cfg_scale, 7);
    assertEquals(params.width, 1536);
    assertEquals(params.height, 1536);
  });

  await t.step("3", () => {
    const params = parsePngInfo(
      `anthro, female, red fox, long black hair with pink highlights, bra, underwear, digitigrade, pawpads, foot focus, foot fetish, sitting, 4 toes, 
      sticker, outline, simple background, by braeburned, by alibi-cami, by ultrabondagefairy, by dripponi, <lora:easy_sticker:0.5>
      Negative prompt: boring_e621_v4, happy, smile, 
      Steps: 40, Sampler: Euler a, CFG scale: 7, Seed: 3154849350, Size: 512x512, Model hash: fd926f7598, Model: bb95FurryMix_v100,
      Denoising strength: 0.65, Lora hashes: "easy_sticker: 2c98dc945091", Version: v1.3.2`,
    );
    assertMatch(params.prompt ?? "", /\bbra\b/);
    assertMatch(params.prompt ?? "", /\blora:easy_sticker\b/);
    assert(!params.prompt?.includes("smile"));
    assert(!params.prompt?.includes("Euler a"));
    assert(!params.prompt?.includes("bb95FurryMix_v100"));
    assertMatch(params.negative_prompt ?? "", /\bboring_e621_v4\b/);
    assert(!params.negative_prompt?.includes("simple background"));
    assert(!params.negative_prompt?.includes("easy_sticker"));
    assert(!params.negative_prompt?.includes("bb95FurryMix_v100"));
    assertEquals(params.steps, 40);
    assertEquals(params.cfg_scale, 7);
    assertEquals(params.width, 512);
    assertEquals(params.height, 512);
  });
});
