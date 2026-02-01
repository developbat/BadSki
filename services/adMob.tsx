/**
 * AdMob – Tek dosyadan yönetim
 * Banner + Interstitial. Test/Prod buradan değiştirilir.
 * iOS: Info.plist GADApplicationIdentifier
 * Android: AndroidManifest meta-data com.google.android.gms.ads.APPLICATION_ID
 * bu dosyadaki app ID'lerle aynı olmalı.
 */

import React from 'react';
import { Platform } from 'react-native';
import {
  MobileAds,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// —— Test / Prod ——
const USE_TEST_ADS = true;

// —— Uygulama ID'leri (AdMob hesabından; test için aşağıdakiler kullanılabilir) ——
const ADMOB_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511';
const ADMOB_APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713';

// —— Banner reklam birim ID'leri ——
const BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
const BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';

// —— Interstitial reklam birim ID'leri ——
const INTERSTITIAL_ID_IOS = 'ca-app-pub-3940256099942544/4411468910';
const INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';

// —— Ödüllü reklam birim ID'leri ——
const REWARDED_ID_IOS = 'ca-app-pub-3940256099942544/1712485313';
const REWARDED_ID_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

/** Ödüllü reklam izleyince verilecek puan (mağaza – puan ürünü) */
export const REWARDED_POINTS = 1000;

export function getAdMobAppId(): string {
  return Platform.OS === 'ios' ? ADMOB_APP_ID_IOS : ADMOB_APP_ID_ANDROID;
}

function getBannerUnitId(): string {
  if (USE_TEST_ADS) return TestIds.BANNER;
  return Platform.OS === 'ios' ? BANNER_ID_IOS : BANNER_ID_ANDROID;
}

function getInterstitialUnitId(): string {
  if (USE_TEST_ADS) return TestIds.INTERSTITIAL;
  return Platform.OS === 'ios' ? INTERSTITIAL_ID_IOS : INTERSTITIAL_ID_ANDROID;
}

function getRewardedUnitId(): string {
  if (USE_TEST_ADS) return TestIds.REWARDED;
  return Platform.OS === 'ios' ? REWARDED_ID_IOS : REWARDED_ID_ANDROID;
}

let interstitialInstance: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let rewardedInstance: ReturnType<typeof RewardedAd.createForAdRequest> | null = null;

function getInterstitial() {
  if (!interstitialInstance) {
    interstitialInstance = InterstitialAd.createForAdRequest(getInterstitialUnitId(), {
      requestNonPersonalizedAdsOnly: USE_TEST_ADS,
    });
  }
  return interstitialInstance;
}

function getRewarded() {
  if (!rewardedInstance) {
    rewardedInstance = RewardedAd.createForAdRequest(getRewardedUnitId(), {
      requestNonPersonalizedAdsOnly: USE_TEST_ADS,
    });
  }
  return rewardedInstance;
}

/** Uygulama açılışında bir kez çağırın */
export function initAdMob(): Promise<void> {
  return MobileAds().initialize();
}

/** Banner bileşeni için unitId */
export function getBannerUnitIdExport(): string {
  return getBannerUnitId();
}

/** Banner reklam bileşeni (alt kısımda kullanın) */
export function AdBanner(): React.JSX.Element {
  return (
    <BannerAd
      unitId={getBannerUnitId()}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: USE_TEST_ADS }}
    />
  );
}

/**
 * Interstitial'i yükle (oyun biterken önce çağrılabilir)
 */
export function loadInterstitial(): void {
  getInterstitial().load();
}

/**
 * Ödüllü reklamı yükle (mağaza – toplu puan için)
 */
export function loadRewarded(): void {
  getRewarded().load();
}

/**
 * Interstitial yükle ve göster. Kapandığında onDone çağrılır, sonra tekrar yüklenir.
 */
export function showInterstitialWhenReady(onDone?: () => void): void {
  const ad = getInterstitial();
  const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    unsubLoaded();
    ad.show();
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    if (onDone) onDone();
    loadInterstitial();
  });
  ad.load();
}

/**
 * Ödüllü reklam yükle ve göster. Ödül alındığında onRewarded(puan) çağrılır; kapandığında tekrar yüklenir.
 * Verilen puan = REWARDED_POINTS (reklam payload'ındaki amount kullanılmıyor, sabit puan).
 */
export function showRewardedWhenReady(onRewarded: (points: number) => void): void {
  const ad = getRewarded();
  const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    unsubLoaded();
    ad.show();
  });
  ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    onRewarded(REWARDED_POINTS);
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    loadRewarded();
  });
  ad.load();
}
