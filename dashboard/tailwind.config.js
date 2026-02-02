export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0c0c0e",
                foreground: "#f8fafc",
                card: "rgba(255, 255, 255, 0.03)",
                border: "rgba(255, 255, 255, 0.08)",
            }
        },
    },
    plugins: [],
}
