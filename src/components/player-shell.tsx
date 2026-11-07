'use client';

import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls, { type HlsConfig } from 'hls.js';

import { PlaybackRecovery, describeHlsError } from '@/lib/playback-recovery';
import { createHlsLoader } from '@/lib/hls-loader';
import {
  getVideoPrefetcher,
  getNextEpisodePrefetcher,
} from '@/lib/video-prefetcher';
import { attachVolumeBoost, type VolumeBoostHandle } from '@/lib/volume-boost';
import { loadCacheSettings } from '@/lib/video-cache';
import { formatTime } from '@/lib/utils';
import { prefersTouchPointer } from '@/lib/touch-pointer';
import {
  findActiveSegment,
  findCrossedEnding,
  resolveSegments,
  SEGMENT_COLORS,
  SEGMENT_LABELS,
  type ResolvedSegment,
  type SkipMark,
  type SkipSegment,
} from '@/lib/skip-marks';
import {
  ART_DEFAULT_CONTROL_HIDE_MS,
  DESKTOP_CONTROL_HIDE_MS,
  TOUCH_CONTROL_HIDE_MS,
} from '@/lib/control-hide';

/** 片段时间统一保留 1 位小数：与面板展示保持一致，避免浮点尾巴 */
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 检测当前浏览器是否为 Safari（含 iOS Safari）。
 * Safari 原生支持 HLS，使用原生播放可以启用 AirPlay 投屏功能；
 * 而 hls.js 基于 MediaSource Extensions，会阻断 AirPlay。
 */
const isSafariNative = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Safari 的 UA 包含 "Safari/" 但不包含 "Chrome/" 或 "Chromium/"
  const isSafariUA = /Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua);
  // iOS 上所有浏览器都是 Safari 内核
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  return isSafariUA || isIOS;
};