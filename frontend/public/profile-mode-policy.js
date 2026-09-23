export const PROFILE_MODE_POLICY_VERSION = 1;

export const GENERAL_PROFILE_MODES = Object.freeze({
  strict: Object.freeze({ label: "Focused", scoreMultiplier: 1.8, domainThreshold: 20 }),
  balanced: Object.freeze({ label: "Balanced", scoreMultiplier: 1, domainThreshold: 12 }),
  broad: Object.freeze({ label: "Research mode", scoreMultiplier: 0.5, domainThreshold: 8 }),
});

export const IDENTITY_AUTHORITY_MODES = Object.freeze({
  focused: Object.freeze({
    label: "Focused",
    description: "Issuance, security, ID cards and passport lifecycle.",
  }),
  balanced: Object.freeze({
    label: "Balanced",
    description: "Also includes broader government ID document context.",
  }),
  broad: Object.freeze({
    label: "Research mode",
    description: "Research mode for adjacent authority and civil identity context.",
  }),
});

export function normalizeGeneralProfileMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return Object.hasOwn(GENERAL_PROFILE_MODES, mode) ? mode : "balanced";
}

export function normalizeIdentityAuthorityMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return Object.hasOwn(IDENTITY_AUTHORITY_MODES, mode) ? mode : "focused";
}

export function getProfileModePolicy(profileId, generalMode, identityAuthorityMode) {
  if (profileId === "passport_authority") {
    const id = normalizeIdentityAuthorityMode(identityAuthorityMode);
    return Object.freeze({
      version: PROFILE_MODE_POLICY_VERSION,
      id,
      label: IDENTITY_AUTHORITY_MODES[id].label,
      scope: "identity_document_authority",
      userSelectable: true,
    });
  }

  const id = normalizeGeneralProfileMode(generalMode);
  return Object.freeze({
    version: PROFILE_MODE_POLICY_VERSION,
    id,
    label: GENERAL_PROFILE_MODES[id].label,
    scope: "general_legacy",
    userSelectable: false,
    scoreMultiplier: GENERAL_PROFILE_MODES[id].scoreMultiplier,
    domainThreshold: GENERAL_PROFILE_MODES[id].domainThreshold,
  });
}
