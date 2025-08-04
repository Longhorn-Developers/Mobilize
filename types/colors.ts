const colors = {
  ut: {
    burntorange: "#BF5700",
    black: "#333F48",
    orange: "#F8971F",
    yellow: "#FFD600",
    lightgreen: "#A6CD57",
    green: "#579D42",
    teal: "#00A9B7",
    blue: "#005F86",
    gray: "#9CADB7",
    offwhite: "#D6D2C4",
  },
  theme: {
    red: "#D10000",
    black: "#1A2024",
    offwhite: "#D6D2C4",
    black1: "#333F4850",
    black2: "#333F4820",
    staticwhite: "#FFFFFF",
    staticblack: "#1A2024",
    majorgridline: "#D1D5DB",
    minorgridline: "#F3F4F6",
  },
} as const satisfies Record<string, Record<string, string>>;

export default colors;
