import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // Adicione regras personalizadas aqui se quiser
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off", // Permitir console.log para ver o QR code
    },
  }
);
