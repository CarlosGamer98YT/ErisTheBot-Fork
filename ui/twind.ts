import { defineConfig, injectGlobal, install } from "twind/core";
import presetTailwind from "twind/preset-tailwind";

const twConfig = defineConfig({
  presets: [presetTailwind()],
});

install(twConfig);

injectGlobal`
  @layer base {
    html {
      @apply h-full bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100;
    }
    
    body {
      @apply min-h-full flex flex-col;
    }
  }

  @layer utilities {
    .bg-stripes {
      background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 14px,
        rgba(0, 0, 0, 0.1) 14px,
        rgba(0, 0, 0, 0.1) 28px
      );
      animation: bg-scroll 0.5s linear infinite;
      background-size: 40px 40px;
    }
    @keyframes bg-scroll {
      to {
        background-position: 40px 0;
      }
    }

    .ripple {
      position: relative;
    }
    .ripple:not([disabled])::after {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0;
      background-image: radial-gradient(circle, rgba(255, 255, 255, 0.2) 10%, transparent 10%);
      background-size: 1500%;
      background-repeat: no-repeat;
      background-position: center;
      transition:
        background 0.4s,
        opacity 0.7s;
    }
    .ripple:not([disabled]):active::after {
      opacity: 1;
      background-size: 0%;
      transition:
        background 0s,
        opacity 0s;
    }

    .backdrop-animate-fade-in::backdrop {
      animation: fade-in 0.3s ease-out forwards;
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }

    .animate-pop-in {
      animation: pop-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    @keyframes pop-in {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
    }
  }
  
  @layer components {
    .link {
      @apply text-sky-600 dark:text-sky-500 rounded-sm focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-sky-600 dark:focus:outline-sky-500;
    }

    .spinner {
      @apply h-8 w-8 animate-spin rounded-full border-4 border-transparent border-t-current;
    }

    .button-filled {
      @apply rounded-md bg-sky-600 px-3 py-2 min-h-12
        text-sm font-semibold uppercase tracking-wider text-white shadow-sm transition-all 
        hover:bg-sky-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-600 
        disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500;
    }

    .button-outlined {
      @apply rounded-md bg-transparent px-3 py-2 min-h-12 ring-1 ring-inset ring-sky-600/100
        text-sm font-semibold uppercase tracking-wider text-sky-600 transition-all 
        hover:ring-sky-500/100 hover:text-sky-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-600 
        disabled:ring-zinc-300 disabled:text-zinc-300 dark:disabled:ring-zinc-700 dark:disabled:text-zinc-500;
    }

    .button-ghost {
      @apply rounded-md bg-transparent px-3 py-2 min-h-12 ring-1 ring-inset ring-transparent
        text-sm font-semibold uppercase tracking-wider transition-all 
        hover:ring-current focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-current
        disabled:text-zinc-500;
    }

    .tab {
      @apply inline-flex items-center px-4 text-sm text-center bg-transparent border-b-2 sm:text-base whitespace-nowrap focus:outline-none
        border-transparent dark:text-white cursor-base hover:border-zinc-400 focus:border-zinc-400 transition-all;
    }

    .tab-active {
      @apply text-sky-600 border-sky-500 dark:border-sky-600 dark:text-sky-500 hover:border-sky-400 focus:border-sky-400;
    }

    .input-text {
      @apply block appearance-none rounded-md border-none bg-transparent px-3 py-1.5 
        text-zinc-900 shadow-sm outline-none ring-1 ring-inset ring-zinc-400 
        placeholder:text-zinc-500 focus:ring-2 focus:ring-sky-600/100
        dark:text-zinc-100 dark:ring-zinc-600;
    }

    .input-range {
      @apply h-6 cursor-pointer accent-sky-600;
    }

    .dialog {
      @apply overflow-hidden overflow-y-auto rounded-md 
        bg-zinc-100 text-zinc-900 shadow-lg backdrop:bg-black/30 dark:bg-zinc-800 dark:text-zinc-100;
    }
  }
`;
