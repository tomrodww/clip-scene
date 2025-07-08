import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom theme colors using CSS variables (defined in globals.css)
        'theme-primary': 'var(--color-primary)',
        'theme-primary-dark': 'var(--color-primary-dark)',
        'theme-primary-light': 'var(--color-primary-light)',
        'theme-bg-primary': 'var(--color-bg-primary)',
        'theme-bg-secondary': 'var(--color-bg-secondary)',
        'theme-bg-tertiary': 'var(--color-bg-tertiary)',
        'theme-text-primary': 'var(--color-text-primary)',
        'theme-text-secondary': 'var(--color-text-secondary)',
        'theme-text-muted': 'var(--color-text-muted)',
        'theme-border-primary': 'var(--color-border-primary)',
        'theme-border-secondary': 'var(--color-border-secondary)',
        'theme-success': 'var(--color-success)',
        'theme-error': 'var(--color-error)',
        'theme-warning': 'var(--color-warning)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
};

export default config; 