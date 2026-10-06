import type { MetadataRoute } from "next";

export default function metadata(): MetadataRoute.Manifest{
    return(
        {
            name: "Look Up",
            start_url: "/",
            display: "standalone",
            background_color: "#b55912",
            theme_color: "#0ca628",
            icons: [
                {
                    src: "/icons/icon_x192.png",
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "/icons/icon_x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "/icons/maskable_icon_x192.png",
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: "/icons/maskable_icon_x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any"
                },   
            ],
        }
    )
}