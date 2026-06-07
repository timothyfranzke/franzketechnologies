import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { computeOgPayload } from '../../src/lib/og-data.js';
import { formatCents } from '../../src/lib/vacationMath.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(__dirname, 'og-fonts');

const fonts = [
  {
    name: 'Manrope',
    data: readFileSync(join(fontsDir, 'manrope-400.woff')),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Manrope',
    data: readFileSync(join(fontsDir, 'manrope-700.woff')),
    weight: 700,
    style: 'normal',
  },
  {
    name: 'Fraunces',
    data: readFileSync(join(fontsDir, 'fraunces-900.woff')),
    weight: 900,
    style: 'normal',
  },
];

const COLORS = {
  cream: '#F3E8D2',
  paper: '#FAF1DF',
  ink: '#2B2118',
  dusty: '#7A6B5B',
  sage: '#5B7C5C',
  rust: '#C14A33',
};

function toneColors(tone) {
  if (tone === 'positive') return { accent: COLORS.sage, label: 'is owed' };
  if (tone === 'negative') return { accent: COLORS.rust, label: 'owes' };
  return { accent: COLORS.ink, label: 'is settled up' };
}

function el(type, props, ...children) {
  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  return createElement(type, props, ...flat);
}

function CardShell({ children }) {
  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        padding: 72,
        background: COLORS.cream,
        fontFamily: 'Manrope',
        color: COLORS.ink,
        position: 'relative',
      },
    },
    el(
      'div',
      {
        style: {
          fontFamily: 'Manrope',
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color: COLORS.rust,
        },
      },
      'Vacation Splitter'
    ),
    children
  );
}

function renderFamilyBalance(payload) {
  const { accent } = toneColors(payload.tone);
  const verb = payload.tone === 'positive' ? 'is owed' : payload.tone === 'negative' ? 'owes' : 'is settled up';
  const amountStr = payload.tone === 'neutral' ? '' : formatCents(Math.abs(payload.netCents));

  return CardShell({
    children: el(
      'div',
      {
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginTop: 12,
        },
      },
      el(
        'div',
        {
          style: {
            fontFamily: 'Fraunces',
            fontWeight: 900,
            fontSize: 64,
            color: COLORS.ink,
            lineHeight: 1.05,
          },
        },
        payload.familyName
      ),
      el(
        'div',
        {
          style: {
            fontFamily: 'Manrope',
            fontWeight: 400,
            fontSize: 32,
            color: COLORS.dusty,
            marginTop: 8,
          },
        },
        verb
      ),
      payload.tone !== 'neutral'
        ? el(
            'div',
            {
              style: {
                fontFamily: 'Fraunces',
                fontWeight: 900,
                fontSize: 168,
                color: accent,
                lineHeight: 1,
                marginTop: 16,
              },
            },
            amountStr
          )
        : null,
      el(
        'div',
        {
          style: {
            fontFamily: 'Manrope',
            fontWeight: 700,
            fontSize: 28,
            color: COLORS.ink,
            marginTop: payload.tone === 'neutral' ? 24 : 32,
          },
        },
        `on ${payload.tripName}`
      )
    ),
  });
}

function renderTripStats(payload) {
  return CardShell({
    children: el(
      'div',
      {
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginTop: 12,
        },
      },
      el(
        'div',
        {
          style: {
            fontFamily: 'Fraunces',
            fontWeight: 900,
            fontSize: 96,
            color: COLORS.ink,
            lineHeight: 1.05,
          },
        },
        payload.tripName
      ),
      payload.expenseCount > 0
        ? el(
            'div',
            {
              style: {
                fontFamily: 'Fraunces',
                fontWeight: 900,
                fontSize: 140,
                color: COLORS.rust,
                lineHeight: 1,
                marginTop: 24,
              },
            },
            formatCents(payload.totalCents)
          )
        : null,
      el(
        'div',
        {
          style: {
            fontFamily: 'Manrope',
            fontWeight: 700,
            fontSize: 28,
            color: COLORS.dusty,
            marginTop: 24,
          },
        },
        payload.expenseCount === 0
          ? `${payload.familyCount} ${payload.familyCount === 1 ? 'family' : 'families'} · no expenses yet`
          : `across ${payload.familyCount} ${payload.familyCount === 1 ? 'family' : 'families'}`
      )
    ),
  });
}

function renderGeneric(payload) {
  return CardShell({
    children: el(
      'div',
      {
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginTop: 12,
        },
      },
      el(
        'div',
        {
          style: {
            fontFamily: 'Fraunces',
            fontWeight: 900,
            fontSize: 120,
            color: COLORS.ink,
            lineHeight: 1.05,
          },
        },
        payload.title
      ),
      el(
        'div',
        {
          style: {
            fontFamily: 'Manrope',
            fontWeight: 400,
            fontSize: 36,
            color: COLORS.dusty,
            marginTop: 24,
          },
        },
        payload.subtitle
      )
    ),
  });
}

function renderElement(payload) {
  if (payload.variant === 'family-balance') return renderFamilyBalance(payload);
  if (payload.variant === 'trip-stats') return renderTripStats(payload);
  return renderGeneric(payload);
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const family = url.searchParams.get('family');

    const payload = await computeOgPayload({ code, family });

    const svg = await satori(renderElement(payload), {
      width: 1200,
      height: 630,
      fonts,
    });

    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    })
      .render()
      .asPng();

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (err) {
    console.error('og function error:', err);
    return new Response('og render failed', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export const config = {
  path: '/.netlify/functions/og',
};
