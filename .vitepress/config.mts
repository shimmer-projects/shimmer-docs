import {defineConfig} from "vitepress"
import { getSideBarList } from './utils' // 引入 getSideBarList 方法

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Shimmer Docs",
    titleTemplate: "SHIMMER",
    description: "A VitePress Site",
    // 主题切换
    appearance: true,
    lang: "zh-CN",
    base: "/",
    cleanUrls: true,
    srcDir: "./src",
    srcExclude: ["site/**"],
    outDir: "./target/dist",
    cacheDir: "./target/cache",
    lastUpdated: true,
    head: [["link", {rel: "icon", href: "/favicon.ico"}]],
    themeConfig: {
        logo: "/public/favicon.ico",
        siteTitle: "SHIMMER",
        search: {
            provider: 'local'
        },
        nav: [
            {text: "Home", link: "/"},
            {text: "Examples", link: "/docs/markdown-examples"},
            {text: "Bookmark", link: "/docs/bookmark"},
            {
                text: '实战教学篇',
                items: [
                    {
                        text: '原生 JS 开发',
                        link: '/teach/index'
                    },
                    {
                        text: 'Vue',
                        link: '/teach/index'
                    },
                    {
                        text: 'React',
                        link: '/teach/index'
                    },
                    {
                        text: 'CRXJS Vue',
                        link: '/teach/index'
                    },
                    {
                        text: 'CRXJS React',
                        link: '/teach/index'
                    }
                ]
            },
        ],
        socialLinks: [
            {icon: "github", link: "https://github.com/vuejs/vitepress"}
        ],
        sidebar: [
            {
                text: "Examples",
                collapsed: true,
                items: [
                    {text: "Markdown Examples", link: "/docs/markdown-examples"},
                    {text: "Runtime API Examples", link: "/docs/api-examples"}
                ]
            },
            {
                text: '基础篇',
                items: [
                    { text: '基础篇', link: '/basic/index' },
                    { text: '基础篇1', link: '/basic/basic1' },
                    { text: '基础篇2', link: '/basic/basic2' }
                ]
            },
            {
                text: 'API 篇',
                items: [
                    { text: 'API篇', link: '/api/index' },
                    { text: 'API篇1', link: '/api/api1' },
                    { text: 'API篇2', link: '/api/api2' }
                ]
            },
            {
                text: '核心篇',
                items: [
                    { text: '核心篇', link: '/core/index' },
                    { text: '核心篇1', link: '/core/core1' },
                    { text: '核心篇2', link: '/core/core2' }
                ]
            },
            {
                text: '教学篇',
                items: [
                    { text: '教学篇', link: '/teach/index' },
                    { text: '教学篇1', link: '/teach/teach1' },
                    { text: '教学篇2', link: '/teach/teach2' }
                ]
            },
            {
                text: '总结篇',
                items: [
                    { text: '总结篇', link: '/summarize/index' },
                    { text: '总结篇', link: '/summarize/summarize1' },
                    { text: '总结篇', link: '/summarize/summarize2' }
                ]
            },
            {
                text: '团队篇',
                items: [
                    { text: '团队篇', link: '/team/index' },
                    { text: '团队篇', link: '/team/team1' },
                    { text: '团队篇', link: '/team/team2' }
                ]
            }
        ],
        // sidebar: {
        //     '/basic/': getSideBarList('/basic'),
        //     '/api/': getSideBarList('/api'),
        //     '/core/': getSideBarList('/core'),
        //     '/teach/': getSideBarList('/teach'),
        //     '/summarize/': getSideBarList('/summarize'),
        //     '/team/': getSideBarList('/team'),
        // },
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2024-present gqk'
        }
    }
})
