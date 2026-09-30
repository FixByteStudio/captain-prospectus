/** The active script both local seeds post: seed.mjs and seed-blank.mjs. */
export const script = {
  name: "Questionnaire par défaut",
  questions: [
    { key: "has_delivery", label: "Proposez-vous la livraison ?", type: "yes_no", required: true },
    {
      key: "pos_system",
      label: "Quel logiciel de caisse utilisez-vous ?",
      type: "single",
      options: ["Aucun", "Papier", "Une autre application"],
    },
    { key: "covers_per_day", label: "Combien de couverts par jour ?", type: "number" },
    { key: "remarks", label: "Remarques", type: "text" },
  ],
};
