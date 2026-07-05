# AGENT.md - Proje Kimligi, Kisitlar ve Gecis Gercegi

Bu dosya, PLAN.EX icin iki farkli seyi ayni anda acik tutar:

1. `TASKS.md` dosyasinda tanimlanan hedef mimari
2. Kod tabaninin bugun gercekte nasil calistigi

Bu ayrimi kaybetmeyin. Proje SaaS yonunde ilerliyor, fakat tam Supabase source-of-truth noktasina henuz gelmis degil. Bu dosya repo icin tek ajan rehberidir.

## Hizli Komutlar

```bash
# Development
npm run dev

# Quality
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:ui
npm run test:e2e

# Analysis
ANALYZE=true npm run build
```

## Proje Kimligi

| Alan | Deger |
| --- | --- |
| Proje adi | PLAN.EX V2 (repo/Vercel: PLANEX-V2 / planex-v2, kod adi STEMA) |
| Slogan | Plan. Execute. Be Expert. |
| Tur | Public landing + Supabase auth + protected productivity app + STEM AI ogrenme katmani |
| Gelisim durumu | Supabase auth + planner/tracker cloud sync + learn/AI backend gercekten Supabase'e bagli (2026-07-05 oncesi Firestore/localStorage'a sessizce dusuyordu, artik degil). Google/GitHub OAuth provider'lari Supabase dashboard'da henuz etkinlestirilmedi. |
| Son oturum notu (2026-07-05) | Firebase tamamen kaldirildi (paket + kod), yeni Supabase projesi (`xtkovwztuopzeqpazxur`) olusturuldu, tam sema + RLS uygulandi, authStore/plannerRepo/trackerRepo/api edge fonksiyonlari Supabase'e tasindi, Vercel'e deploy edildi (`planex-v2.vercel.app`). |
| Konum | `C:\\Users\\HP\\DEV\\STEMA` (klasor adi henuz PLANEX-V2 olarak degistirilemedi — baska bir surec kilitliyor) |
| Dev sunucu | `http://localhost:3000` |
| Ana stack | React 18, TypeScript 5.7, Vite 6, Tailwind 3, Framer Motion 12, Supabase, Dexie, Zustand |

## Proje Yapisi

```text
src/
├── app/                    # App shell, router, providers
│   ├── App.tsx             # Public ve protected route agaci
│   ├── layouts/            # AppLayout
│   └── providers/          # Theme, i18n sync, profile sync, cloud bootstrap
├── modules/
│   ├── auth/               # Landing, callback, profile setup, onboarding
│   ├── planner/            # Planner modulu
│   ├── tracker/            # Time tracking modulu
│   └── settings/           # Settings ve profile settings
├── db/                     # Dexie tabanli local veri katmani
├── i18n/                   # Translation dosyalari ve provider
├── shared/                 # Shared component, hook ve util'ler
└── index.css               # Design tokens ve base styling
```

## Kaynak Onceligi

Asagidaki sirayi izleyin:

1. `PROGRESS.md`
   Hedefe gore bugun gercekte nereye gelindigini soyler.
2. `TASKS.md`
   Hedef urun ve hedef mimari dokumanidir.
3. `src/app/App.tsx`
   Guncel route ve shell gercegidir.
4. `src/modules/auth/store/authStore.ts`
   Auth, profile completion, onboarding ve preference sync gercegidir.
5. `src/app/providers/CloudDataBootstrap.tsx`
   Local-to-cloud bootstrap davranisinin bugunku gercegidir.
6. `src/lib/cloud/domainSync.ts`
   Sync/hydration ve cloud-first conflict mantiginin bugunku gercegidir.

Kural:

- Hedefi "tamamlanmis" gibi belgeleme.
- Bugunku implementasyonu "tam Supabase gecildi" gibi anlatma.
- Her zaman current state ile target state arasina cizgi cek.

## Bugunku Uygulama Durumu

2026-03-13 itibariyla canli olanlar:

- `/` rotasinda public landing
- landing hero'sunda tek OAuth CTA yuzeyi, sessiz premium OAuth buttonlari, solid panel dili ve footer sign-off
- Google ve GitHub OAuth
- `/auth/callback` callback processing
- kanonik `/auth/profile-completion` ve uyumluluk alias'i `/auth/profile-setup`
- render oncesi auth bootstrap
- `App.tsx` icinde public ve protected route katmanlari
- `AppLayout` yalnizca authenticated shell
- `/settings/profile` profil duzenleme ve avatar upload
- `/planner` uzerinde 8 adimli onboarding overlay
- Auth state ekranlari: initial loading, redirect pending, profile loading, bootstrap loading
- Theme ve locale tercihlerinin profile sync edilmesi; explicit kullanici secimi profile hydrate sonrasi geri ezilmez
- Local veri bulunursa cloud bootstrap/import prompt'u
- yeni authenticated kullanicilar icin remote default seed akisi
- settings ve pomodoro icin remote runtime tablo temeli
- tracker aktivite modalinda lokalize Lucide ikon katalogu, ikon arama ve sablondan baslama akisi
- planner modallarinda ders, ders gorevi, kisisel gorev ve aliskanlik icin kalici Lucide ikon secimi; create/update/delete akislarinda await-temelli success/error toast sertlestirmesi

Halen gecis asamasinda olanlar:

- Planner ve tracker query layer ve service layer artik Supabase-first; `PlannerDatabase` ve `LifeFlowDB` Dexie veritabanlari cloud bootstrap hydration ve backup cache icin ayakta.
- `CloudDataBootstrap.tsx` hibrit akisti yonetiyor; query ve service layer Supabase-first olduktan sonra sadeleştirilebilir.
- `domainSync.ts` icindeki `syncDomainTables` artik no-op shim; `hydrateLocalCacheFromCloud`, `getDomainSyncSummary` ve `clearLocalDomainCaches` aktif. `rules`, `reminders`, `completionRecords` tablolari da eklendi.
- Tracker servisleri (`timerService.ts`, `ruleEngine.ts`, `suggestionEngine.ts`, `exportService.ts`) Supabase-first olarak yeniden yazildi.
- `backupService.ts` authenticated kullanicida Supabase-first export yapiyor; Dexie fallback korunuyor.
- Tam Supabase source-of-truth mimarisi, `TASKS.md` hedefidir; query layer, repo katmani ve service layer artik tamamen oraya getirildi.

## Mimari Kararlar

### 1. Public surface

- `/` artik landing ekranidir; eski "dogrudan planner" varsayimi gecerli degil.
- Landing screenshot degil, metin + feature card odakli olmalidir.
- Hero icinde tema ve dil kontrolleri gorunur kalmalidir.
- Header theme toggle system/light/dark etiketlerini aciga vurmaz; icon-only binary light/dark override gibi davranir. `system` secenegi settings icinde kalir.
- Google ve GitHub CTA'lari esit hiyerarsiyle gosterilmelidir.

### 2. Auth ve profil

- Auth provider'lari yalnizca `google` ve `github`'dir.
- Email/password akisi eklemeyin; acik istek olmadikca genisletmeyin.
- `full_name`, `occupation`, `student_status` temel zorunlu profil alanlaridir.
- `student_status` `student` veya `both` ise `school` ve `department` alanlari gerekli hale gelir.
- Avatar yukleme zorunlu degildir; provider avatari preview edilebilir, kullanici daha sonra degistirebilir.

### 3. Onboarding

- Onboarding ayri bir sayfa degil, urun ustu overlay'dir.
- Hedef akis 8 adimdir.
- `skip` gorunur ve erisilebilir kalmalidir.
- Ayarlardan yeniden baslatilabilmelidir.
- Hedef element bulunamazsa guvenli fallback gerekir.
- Route degisirse akis guvenli sekilde kapanmali veya dogru hedefte devam etmelidir.

### 4. Veri katmani

- Auth/profile icin Supabase ana kaynaktir.
- Settings ve pomodoro default bootstrap icin remote runtime tablolar eklendi.
- Planner ve tracker query layer artik Supabase-first (`plannerRepo` + `trackerRepo` uzerinden calisiyor).
- Tracker service layer (`timerService`, `ruleEngine`, `suggestionEngine`, `exportService`) artik Supabase-first.
- `trackerRepo.ts` Rule ve Reminder CRUD fonksiyonlari da iceriyor.
- Tum query dosyalari (`src/db/**/queries/**`) `useSupabaseQuery` + repo fonksiyonlarini kullaniyor; `useLiveQuery` ve `syncDomainTables` kaldirildi.
- Cloud sync tarafinda conflict kuralı cloud-first'tur.
- Local cache ownership mantigi korunmalidir; kullanici degisince eski owner verisi karismamali.
- Yeni cloud tablo tasarimlarinda `user_id` ve RLS dusuncesi baslangictan itibaren korunmalidir.
- `PlannerDatabase` ve `LifeFlowDB` Dexie schema'lari halen ayakta; cloud bootstrap hydration icin kullanilmakta.

## Hard Kurallar

### Auth ve route kurallari

1. `/` public landing olarak kalir.
2. Protected route'lar auth olmadan render edilmez.
3. Profil eksikse kullanici protected shell'e birakilmaz; profil akisina gider.
4. Auth surface'lerde yeni state ekleniyorsa kullaniciya kisa aciklayici metin de verilmelidir; spinner tek basina yeterli degildir.

### Veri kurallari

1. `LifeFlowDB` ile `PlannerDatabase` farkini koru; halen cloud bootstrap icin aktif.
2. Domain query mutation'larinda `plannerRepo` veya `trackerRepo` kullan; direkt Dexie CRUD yazma.
3. Mutation sonrasi reaktivite icin `invalidateTables([...])` kullan.
4. Kalici domain verisini Zustand'a tasima.
5. Sync/import davranisinda cloud-first conflict mantigini degistirme.
5. Cross-user local cache karismasina yol acacak degisiklik yapma.

### UI/UX kurallari

1. Public landing screenshot kullanmaz; metin + feature card odakli kalir.
2. OAuth butonlari `rounded-lg` (0.5rem) formunda, esit hiyerarside; sessiz premium fill.
3. Kart/modal/sidebar arkaplan: sadece monochrome token (`bg-surface-100/200/300`). Accent tintli kart bg yasak.
4. Icon container'lar: `bg-surface-200 text-text-secondary`. Accent tintli dekoratif icon bg yasak.
5. Shadow: near-zero — sadece `var(--shadow-card)` (1px ring) veya `var(--shadow-card-elevated)` (2px+8px). `shadow-card-elevated` yalnizca floating panel'larda.
6. Motion: sayfa gecisi ~180-200ms fade+slide (y:4px), modal giris 0.18s standard easing. Spring/overshoot (`[0.34, 1.56, 0.64, 1]`) yasak. `src/config/motion.ts` merkezi config; `easing.spring` kaldirildi.
7. H1/H2 weight: 800/700, letter-spacing: -0.03em/-0.025em. Body line-height: 1.6.
8. `reduced-motion` tum animasyonlarda desteklenir.
9. Button: `rounded-lg`, active state `scale(0.985)`, hover `-translateY(1px)`.
10. Onboarding panel: flat border, notr icon/selection card, standard easing.
11. Public landing, profile setup ve onboarding mobile'da da masaustu kadar kullanilabilir olmalidir.

### i18n kurallari

1. Tum yeni gorunen metinler i18n uzerinden gider.
2. `tr` ve `en` locale dosyalari birlikte guncellenir.
3. Auth/public/onboarding degisikliklerinde `auth` namespace'ini once kontrol edin.

## Onay Gerektiren Degisiklikler

Asagidaki degisikliklerde once kullanici onayi alin:

- `src/db/**` altinda schema, migration veya type degisikligi
- Route yapisinin degismesi
- Yeni Zustand store eklenmesi veya store kontratinin buyuk oranda degismesi
- `tailwind.config.js` veya `src/index.css` degisikligi
- Var olan sayfa bilesenlerinin silinmesi

## Guncel Route Haritasi

```text
/                      -> Public landing
/auth/callback         -> OAuth callback
/auth/profile-completion -> Canonical profile completion
/auth/profile-setup    -> Legacy compatibility alias
/planner               -> Planner dashboard
/planner/courses       -> Courses
/planner/courses/:id   -> Course detail
/planner/tasks         -> Personal tasks
/planner/statistics    -> Planner statistics
/calendar              -> Calendar
/habits                -> Habits dashboard
/habits/:habitId       -> Habit detail
/tracker               -> Tracker
/tracker/records       -> Tracker records
/tracker/stats         -> Tracker stats
/tracker/goals         -> Goals
/tracker/activities    -> Activities
/tracker/categories    -> Categories
/settings              -> Settings
/settings/profile      -> Profile settings
```

## Ortam Notlari

- Vite dev server `http://localhost:3000` uzerinden calisir.
- Supabase callback ve allowed origin ayarlari buna gore hizalanmalidir: `http://localhost:3000/auth/callback`.
- `VITE_SUPABASE_URL` veya `VITE_SUPABASE_ANON_KEY` eksikse landing acilir, fakat auth aksiyonlari disabled kalir.
- `VITE_ENABLE_SYNC=true` local-to-cloud bootstrap davranisini acar.
- `VITE_ENABLE_GOOGLE_AUTH=false` veya `VITE_ENABLE_GITHUB_AUTH=false` ile provider bazli kapatma yapilabilir.

## Test Notlari

- Dexie tabanli testlerde `fake-indexeddb` kullanilir.
- Test dosyalari `tests/**/*.test.ts(x)` altindadir.
- Auth akislarinda oncelikli kapsama:
  - callback -> profile setup -> planner redirect
  - onboarding fallback davranisi
  - profile form validation
  - provider disabled ve error state'leri

## Calisma Akisi

1. Once `TASKS.md` ile hedef urun niyetini oku.
2. Sonra `src/app/App.tsx`, `src/modules/auth/store/authStore.ts` ve `src/app/providers/CloudDataBootstrap.tsx` ile mevcut gercegi dogrula.
3. Gorevin bugunku sistemi korumak mi, migration yapmak mi oldugunu ayir.
4. Dokumanda ve kodda current state ile target state farkini acik tut.
5. Davranis degisikliginde en az `npm run typecheck` ve ilgili testleri calistir.

## Oncelikli Yol Haritasi

### 🎯 1. DALGA (Yüksek Öncelikli - Çekirdek Akış ve Canlıya Geçiş)
1. **DeepSeek Entegrasyonu ve LLM Abstraction (Phase 17):** Tüm API çağrılarını `llmClient.ts` altına çekmek ve Feynman analizi için DeepSeek V4 reasoning modunu entegre etmek.
2. **RAG pgvector Embedding & Zihin Haritası (Phase 9 & 10):** Ders notu yükleme, chunking, pgvector ve RAG akışını zihin haritası görselleştirmesiyle tamamlamak.
3. **Production Deploy & Smoke Test (Phase 16):** Canlıya çıkış, RLS denetimi ve OAuth callback doğrulamaları.

### 🌟 2. DALGA (Derinleşme ve Adaptasyonlar)
1. **Gelişmiş Onboarding & Müfredat Tohumlama (Phase 18):** Onboarding ile öğrenci profili çıkarıp prompt enjekte etmek ve hazır EEE, matematik, fizik kavram ağaçlarını tohumlamak.
2. **Mobil Uyumluluk & PWA (Phase 19):** `/learn` sayfasını responsive yapmak ve PWA service worker ile çevrimdışı flashcard çalışmasını desteklemek.
3. **İkinci Dalga Modülleri (Phase 12, 13, 14):** CS Sandbox, Sınav Üretici ve INCUP (DEHB) adaptasyonları.

## Referanslar

- `README.md`: kullanici ve contributor odakli genel dokuman
- `TASKS.md`: hedef SaaS mimarisi ve urun davranisi
- `CLAUDE.md`: Claude Code odakli gelistirme talimatlari
- `ARCHITECTURE.md`: sistem bilesenlerinin tam haritasi, veri akisi, klasor sorumluluklari ve nerede ne degistirilmeli rehberi
