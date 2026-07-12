import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Load environment variables for the API simulator
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
Object.assign(process.env, env)

/**
 * Vite Yapılandırması - Vercel Optimizasyonları
 *
 * Lighthouse Skoru Hedefi: 95+
 * - Kod bölümleme (code splitting)
 * - Tree shaking
 * - Minifikasyon
 * - PWA desteği
 * - Bundle analiz (visualizer)
 * - Görsel optimizasyonu önerileri
 */

const isAnalyze = process.env.ANALYZE === 'true'

const plugins: PluginOption[] = [
    react(),
    {
        name: 'vite-edge-chat-sim',
        configureServer(server: any) {
            server.middlewares.use(async (req: any, res: any, next: any) => {
                console.log("[Vite Middleware Hook] URL:", req.url, "Method:", req.method);
                if (req.url?.startsWith('/api/chat') || req.url?.startsWith('/api/feynman') || req.url?.startsWith('/api/mindmap')) {
                    try {
                        let apiPath = './api/chat.ts'
                        if (req.url.startsWith('/api/feynman')) {
                            apiPath = './api/feynman.ts'
                        } else if (req.url.startsWith('/api/mindmap')) {
                            apiPath = './api/mindmap.ts'
                        }
                        const module = await server.ssrLoadModule(path.resolve(__dirname, apiPath))
                        const handler = module.default
                        console.log("[Vite Middleware Hook] Resolved API Path:", path.resolve(__dirname, apiPath));
                        console.log("[Vite Middleware Hook] Module loaded:", !!module, "Handler loaded:", !!handler);

                        let bodyText = ''
                        await new Promise<void>((resolve, reject) => {
                            req.on('data', (chunk: any) => { bodyText += chunk })
                            req.on('end', () => resolve())
                            req.on('error', (err: any) => reject(err))
                        })

                        const webReq = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
                            method: req.method,
                            headers: req.headers as any,
                            body: ['POST', 'PUT', 'PATCH'].includes(req.method || '') ? bodyText : undefined,
                        })

                        const webRes = await handler(webReq)

                        res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()))

                        if (webRes.body) {
                            const reader = webRes.body.getReader()
                            while (true) {
                                const { done, value } = await reader.read()
                                if (done) break
                                res.write(value)
                            }
                        }
                        res.end()
                    } catch (err: any) {
                        console.error('[Vite Dev Server API Error]:', err)
                        res.writeHead(500, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }))
                    }
                } else {
                    next()
                }
            })
        }
    },
    // Bundle analyzer - generates stats.html after build (only when ANALYZE=true)
    isAnalyze && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap'
    }),
    VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.ico', 'favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
            manifest: {
                name: 'PLAN.EX - Akıllı Planlama',
                short_name: 'PLAN.EX',
                description: 'Akıllı planlama ve verimlilik uygulaması',
                theme_color: '#6366f1',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait-primary',
                categories: ['productivity', 'utilities'],
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
                // Kritik kaynakları önbelleğe al
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 yıl
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 yıl
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Görseller için lazy caching
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 gün
                            }
                        }
                    }
                ],
                // Offline fallback
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/]
            }
        })
].filter(Boolean) as PluginOption[]

export default defineConfig({
    plugins,
    define: {
        global: 'window',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@modules': path.resolve(__dirname, './src/modules'),
            '@shared': path.resolve(__dirname, './src/shared'),
            '@db': path.resolve(__dirname, './src/db'),
            '@events': path.resolve(__dirname, './src/events'),
            '@infra': path.resolve(__dirname, './src/infra'),
            '@planner': path.resolve(__dirname, './src/modules/planner')
        }
    },
    build: {
        // Terser ile minifikasyon
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug']
            },
            format: {
                comments: false
            }
        },
        // Kod bölümleme stratejisi
        rollupOptions: {
            output: {
                // Vendor chunk'ları ayrı dosyalara böl
                manualChunks: (id) => {
                    if (id.includes('node_modules/echarts/')) return 'echarts'
                    if (id.includes('node_modules/react/') ||
                        id.includes('node_modules/react-dom/') ||
                        id.includes('node_modules/react-router-dom/')) {
                        return 'react-vendor'
                    }
                    if (id.includes('node_modules/@heroicons/') ||
                        id.includes('node_modules/@headlessui/') ||
                        id.includes('node_modules/lucide-react/') ||
                        id.includes('node_modules/clsx/')) {
                        return 'ui-vendor'
                    }
                    if (id.includes('node_modules/@excalidraw/')) return 'excalidraw'
                    if (id.includes('node_modules/reactflow/') || id.includes('node_modules/@xyflow/')) return 'reactflow'
                    if (id.includes('node_modules/dexie/') ||
                        id.includes('node_modules/dexie-react-hooks/')) {
                        return 'db-vendor'
                    }
                    if (id.includes('node_modules/zustand/')) return 'state-vendor'
                    return undefined
                },
                // Asset isimlendirme - cache busting
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name?.split('.') || []
                    const ext = info[info.length - 1] || ''
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) {
                        return 'assets/images/[name]-[hash][extname]'
                    }
                    if (/woff2?|eot|ttf|otf/i.test(ext)) {
                        return 'assets/fonts/[name]-[hash][extname]'
                    }
                    return 'assets/[name]-[hash][extname]'
                },
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js'
            }
        },
        chunkSizeWarningLimit: 500, // 500KB uyarı limiti
        cssCodeSplit: true,
        sourcemap: false, // Production'da sourcemap kapalı
        // Reporting için
        reportCompressedSize: true,
        // Asset boyut optimizasyonu
        assetsInlineLimit: 4096, // 4KB altı inline
        commonjsOptions: {
            transformMixedEsModules: true
        }
    },
    // Development optimizasyonları
    server: {
        port: 3000,
        host: true,
        headers: {
            'Content-Security-Policy': [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' data: https://fonts.gstatic.com",
                "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com https://*.googleapis.com",
                "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://github.com https://api.github.com ws://localhost:*",
                "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
                "worker-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self' https://accounts.google.com https://github.com",
            ].join('; '),
        },
    },
    // Preview ayarları
    preview: {
        port: 4173,
        host: true,
        headers: {
            'Content-Security-Policy': [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' data: https://fonts.gstatic.com",
                "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com https://*.googleapis.com",
                "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://github.com https://api.github.com",
                "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
                "worker-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self' https://accounts.google.com https://github.com",
            ].join('; '),
        },
    }
})


