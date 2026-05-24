# Dart Scorer Web App — Design Spec
**Date:** 2026-05-24

## Overview

Arkadaşlarla farklı lokasyonlardan gerçek zamanlı dart oynayabilmek için basit bir web uygulaması. Hesap/kayıt yok, 4 haneli oda kodu ile anında oyuna girilir.

---

## Özellik Listesi

- 4 haneli oda kodu ile oyun oluştur / katıl (2–8 oyuncu)
- Oyuncu isimleri girişi (lobby'de)
- Oyun ayarları: format (BO1 / BO3 / BO5), mod (101 / 201 / 301 / 501)
- Kim başlıyor: ilk leg rastgele; sonraki leglerde önceki legi kaybeden başlar
- Skor girişi: 3 dart'lık tur toplamı tek sayı olarak (tur başında gösterilir)
- Bust kontrolü: skor sıfırın altına düşerse bust (detaylar aşağıda)
- Leg takibi (BO1=1, BO3=ilk 2, BO5=ilk 3, set yok)
- Checkout önerisi: tur başında kalan puana göre en iyi 3-dart kombinasyonu (max 170, double-out gerektirmeyen)
- Tur ortalaması: `toplam_atılan_puan / (tur_sayısı * 3)` (bust turlar dahil)
- Oyun sonu ekranı + paylaş butonu (Web Share API, text özeti, full stats ile)
- Mobil uyumlu tasarım (büyük butonlar, thumb-friendly)
- Karanlık tema (default: `prefers-color-scheme`, toggle ile override, localStorage'a kaydedilir)
- PWA: manifest + service worker (offline'da "internet bağlantısı gerekli" mesajı)

---

## Kural Detayları

### Geçerli Skor Aralığı
- Minimum: 0 (üç dart da kaçtı)
- Maksimum: 180 (3x T20)
- Sunucu [0, 180] dışındaki değerleri reddeder → `error` eventi

### Bust
- Girilen skor kalan puandan büyük → bust, skor geri yüklenir, sıra geçer
- Kalan puan - girilen skor = 0 → leg biter, oyuncu bu legi kazanır
- Kalan puan - girilen skor > 0 → normal, skor düşer

### Leg Geçişi
- Bir oyuncu skoru tam 0'a indirdiğinde leg biter
- `firstPlayerPerLeg` → kaybeden oyuncunun index'ine güncellenir
- Yeni leg başlarken tüm oyuncuların `score` = `settings.mode` olarak sıfırlanır
- `currentPlayerIndex` = `firstPlayerPerLeg` olarak set edilir

### Bust Turu ve Ortalama
- Bust olan tur da `turns[]` dizisine eklenir (0 olarak değil, atılan puan olarak — ama skora yansımaz)
- Ortalama hesabı: `sum(turns) / turns.length / 3`

---

## Mimari

```
Client (Browser)
    ↕ WebSocket (Socket.io)
Server (Node.js + Express + Socket.io)
    → In-memory state (Map<roomCode, GameState>)
```

Veritabanı yok. Oyun state'i sunucunun belleğinde tutulur. Sunucu kapanırsa aktif oyunlar silinir — kabul edilebilir risk.

---

## Sayfa / Ekran Akışı

```
Ana Sayfa
├── [Oyun Oluştur] → Lobi (4 haneli oda kodu üretilir, gösterilir)
└── [Oyuna Katıl]  → kod girişi → Lobi

Lobi
├── Oyuncu isimleri
├── Oyun modu (101/201/301/501)
├── Format (BO1/BO3/BO5)
└── [Başlat] → sadece host başlatabilir, min 2 / max 8 oyuncu

Oyun Ekranı
├── Üst: Oyuncu kartları (isim, kalan puan, leg skoru)
├── Orta: Kimin sırası + checkout önerisi (tur başında)
├── Alt: Skor input (büyük, sayısal klavye) + [Gönder] butonu
└── Her oyuncunun tur ortalaması

Oyun Sonu
├── Kazanan
├── İstatistikler (leg skoru, ortalama)
└── [Paylaş] + [Yeni Oyun]
```

---

## Backend Tasarımı

### Teknolojiler
- **Runtime:** Node.js
- **Framework:** Express
- **Gerçek zamanlı:** Socket.io
- **State:** In-memory `Map<roomCode, GameState>`

### Veri Modeli

```js
GameState {
  roomCode: string              // 4 haneli benzersiz kod
  hostId: string                // socket.id (başlatma yetkisi)
  players: Player[]
  settings: {
    mode: 101 | 201 | 301 | 501
    legsToWin: 1 | 2 | 3       // BO1=1, BO3=2, BO5=3
  }
  currentLegIndex: number
  currentPlayerIndex: number
  firstPlayerThisLeg: number    // bu legin başında ilk atan oyuncu index'i
  status: 'lobby' | 'playing' | 'finished'
  lastActivityAt: number        // Date.now(), inactivity cleanup için
}

Player {
  id: string                    // socket.id (reconnect'te güncellenir)
  name: string
  score: number                 // bu legteki kalan puan
  legsWon: number
  turns: number[]               // tur başına atılan toplam (bust turlar dahil)
}
```

### Oda Yaşam Döngüsü
- 4 haneli kod: üretimde mevcut kodlarla çakışma kontrol edilir, max 100 deneme (sonra `error` eventi)
- Oyun bittiğinde oda 5 dakika sonra temizlenir
- `lastActivityAt` 1 saatten eski odalar periyodik olarak temizlenir
- Oyuncu bağlantısı kesilirse 3 dakika içinde reconnect gelmezse leg forfeit edilir, sıra geçer; tüm oyuncular çıkarsa oda silinir

### Yeniden Bağlanma
- Client aynı oda kodunu + aynı oyuncu adını gönderir
- Server isim eşleşmesine göre `player.id` = yeni socket.id olarak günceller
- Mevcut game state `game-update` ile tekrar gönderilir

### Socket.io Eventleri

| Event | Yön | Payload | Açıklama |
|-------|-----|---------|----------|
| `create-room` | C→S | `{ playerName }` | Oda oluştur |
| `join-room` | C→S | `{ roomCode, playerName }` | Odaya katıl veya reconnect |
| `start-game` | C→S | — | Oyunu başlat (sadece host, min 2 oyuncu) |
| `submit-score` | C→S | `{ score: number }` | Tur skoru gönder |
| `room-update` | S→C | `{ players, status }` | Lobi güncellemesi |
| `game-update` | S→C | `GameState` | Oyun state güncellemesi |
| `game-over` | S→C | `{ winner, players, stats }` | Oyun bitti (full stats dahil) |
| `error` | S→C | `{ message }` | Hata mesajı |

---

## Frontend Tasarımı

### Teknolojiler
- Vanilla HTML / CSS / JavaScript
- Socket.io client (CDN'den)
- Tek HTML dosyası, view'lar JS ile göster/gizle

### Checkout Önerileri
- Sabit lookup table: `CHECKOUTS[n] = "T20 T20 20"` formatında (double zorunluluğu yok)
- 1–180 arası (kalan puana göre en verimli kombinasyon)
- Her zaman tur başında gösterilir, 3 dart varsayımıyla

### Karanlık Tema
- CSS `--bg`, `--text`, `--accent`, `--surface` custom properties
- Default: `prefers-color-scheme` media query
- Toggle buton: kullanıcı override'ı `localStorage`'a kaydedilir

### PWA
- `manifest.json`: isim, ikon, `display: standalone`, tema rengi
- `service-worker.js`: app shell cache, offline'da "internet bağlantısı gerekli" statik mesajı

---

## Deployment

```
Linux Sunucu (Ubuntu, DigitalOcean — 1 vCPU, 1GB RAM, Frankfurt)
├── nginx  → reverse proxy (80/443 → localhost:3000)
├── PM2    → Node.js process manager (otomatik restart)
└── Certbot (Let's Encrypt) → HTTPS
```

---

## Kapsam Dışı

- Kullanıcı hesapları / login
- Veritabanı / kalıcı kayıt
- Cricket modu
- Ses efektleri
- Spectator modu
- Set bazlı format
- Tur başına dart dart skor girişi
- Double-out kuralı
