// ATLAS HACS verification fixture release 0.1.1; runtime behavior unchanged.
const ATLAS_EN = {"title":"Locale test card","unavailable":"Unavailable","replaceDemoEntities":"Replace the demo entities with your own Home Assistant entities."};
const ATLAS_LOCALE_BASE = new URL("./locales/", import.meta.url);
const ATLAS_LOCALES = new Map();
function atlasReadLocale(language) {
  if (!ATLAS_LOCALES.has(language)) ATLAS_LOCALES.set(language, (async () => {
    if (typeof fetch !== "function") return {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(new URL(language + ".json", ATLAS_LOCALE_BASE), {
        credentials: "omit", mode: "same-origin", redirect: "error", cache: "no-cache", signal: controller.signal,
      });
      if (!response.ok) return {};
      const text = await response.text();
      if (text.length > 65536) return {};
      const value = JSON.parse(text);
      if (!value || value._meta?.language !== language || !value.card || Array.isArray(value.card)) return {};
      return Object.fromEntries(Object.keys(ATLAS_EN).flatMap(key => {
        const text = value.card[key];
        return typeof text === "string" && text.trim() && text.length <= 2000 ? [[key, text]] : [];
      }));
    } catch { return {}; }
    finally { clearTimeout(timeout); }
  })());
  return ATLAS_LOCALES.get(language);
}
async function atlasLoadLocale(language) {
  const [english, selected] = await Promise.all([
    atlasReadLocale("en"), language === "en" ? {} : atlasReadLocale(language),
  ]);
  return { ...ATLAS_EN, ...english, ...selected };
}
const DEFAULT_CONFIG = {
  "type": "custom:atlas-hacs-delivery-card",
  "title": "Locale test card",
  "entities": [
    "sensor.atlas_roundtrip_temperature",
    "input_boolean.atlas_roundtrip_lamp"
  ],
  "replacement_hint": "Replace the demo entities with your own Home Assistant entities."
};
const DEFAULT_CARD = {
  "type": "vertical-stack",
  "cards": [
    {
      "type": "horizontal-stack",
      "cards": [
        {
          "type": "entity",
          "name": "Core Temperature",
          "entity": "sensor.atlas_roundtrip_temperature"
        },
        {
          "type": "custom:bubble-card",
          "card_type": "button",
          "button_type": "switch",
          "name": "Bubble Lamp",
          "entity": "input_boolean.atlas_roundtrip_lamp",
          "show_state": true
        }
      ]
    },
    {
      "type": "custom:mushroom-template-card",
      "primary": "Mushroom Lamp",
      "secondary": "input_boolean.atlas_roundtrip_lamp",
      "entity": "input_boolean.atlas_roundtrip_lamp"
    }
  ]
};
class AtlasHacsDeliveryCardCard extends HTMLElement {
  cardLanguage() {
    const requested = this.config?.language || this._hass?.locale?.language || this._hass?.language || "en";
    const base = typeof requested === "string" ? requested.toLowerCase().split(/[-_]/)[0] : "en";
    return /^[a-z]{2}$/.test(base) ? base : "en";
  }
  translated(key) { return this._locale?.[key] ?? ATLAS_EN[key]; }
  localizedTitle() {
    return this.config?.title && this.config.title !== DEFAULT_CONFIG.title
      ? this.config.title : this.translated("title");
  }
  localizedHint() {
    return this.config?.replacement_hint && this.config.replacement_hint !== DEFAULT_CONFIG.replacement_hint
      ? this.config.replacement_hint : this.translated("replaceDemoEntities");
  }

  setConfig(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.config.entities = Array.isArray(config?.entities) && config.entities.length
      ? [...config.entities] : [...DEFAULT_CONFIG.entities];
    this.createCard();
  }
  set hass(value) {
    this._hass = value;
    if (this._card) this._card.hass = value;
    this.updateHint();
    if (this.config && this.cardLanguage() !== this._requestedLanguage) this.createCard();
  }
  getCardSize() { return this._card?.getCardSize?.() ?? 3; }
  static getStubConfig() { return { ...DEFAULT_CONFIG, entities: [...DEFAULT_CONFIG.entities] }; }
  updateHint() {
    if (this._hint) this._hint.hidden = !this._hass || !this.config.entities.some(id => !this._hass.states?.[id]);
  }
  async createCard() {
    const generation = this._generation = (this._generation ?? 0) + 1;
    const language = this._requestedLanguage = this.cardLanguage();
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const replacements = new Map(DEFAULT_CONFIG.entities.map((id, i) => [id, this.config.entities[i] ?? id]));
    const replace = value => typeof value === "string" ? replacements.get(value) ?? value
      : Array.isArray(value) ? value.map(replace)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]))
      : value;
    const cardConfig = replace(DEFAULT_CARD);
    try {
      const locale = await atlasLoadLocale(language);
      if (generation !== this._generation) return;
      this._locale = locale;
      const title = this.localizedTitle();
      if (cardConfig.title === DEFAULT_CONFIG.title) cardConfig.title = title;
      const helpers = await window.loadCardHelpers();
      if (generation !== this._generation) return;
      const card = helpers.createCardElement(cardConfig);
      this._card = card;
      if (this._hass) card.hass = this._hass;
      const heading = document.createElement("div");
      heading.className = "atlas-card-title";
      heading.setAttribute("role", "heading");
      heading.setAttribute("aria-level", "2");
      heading.style.cssText = "padding:8px 4px;font-size:20px;font-weight:500;color:var(--primary-text-color)";
      heading.textContent = title;
      const hint = this._hint = document.createElement("p");
      hint.className = "atlas-card-hint";
      hint.style.cssText = "padding:4px;font-size:14px;color:var(--secondary-text-color)";
      hint.textContent = this.localizedHint();
      this.updateHint();
      root.replaceChildren(...(cardConfig.title === title ? [] : [heading]), card, hint);
    } catch (error) {
      if (generation !== this._generation) return;
      const message = document.createElement("ha-card");
      this._card = undefined;
      message.textContent = this.translated("unavailable");
      root.replaceChildren(message);
    }
  }
}
if (!customElements.get("atlas-hacs-delivery-card")) customElements.define("atlas-hacs-delivery-card", AtlasHacsDeliveryCardCard);
window.customCards = window.customCards ?? [];
if (!window.customCards.some(card => card.type === "atlas-hacs-delivery-card")) window.customCards.push({
  type: "atlas-hacs-delivery-card", name: "Locale test card", preview: true,
  description: "Replace the demo entities with your own Home Assistant entities.",
});
