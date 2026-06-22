export interface FloatingSettings {
  social: {
    active: boolean;
    position: 'left-bottom' | 'right-bottom' | 'left-top' | 'right-top';
    icons: Array<{
      id: string;
      platform?: string;
      url?: string;
      active?: boolean;
      color?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  scrollTop: {
    active: boolean;
    shape: 'circle' | 'square' | 'rounded';
    position: 'left-bottom' | 'right-bottom';
    color?: string;
    [key: string]: any;
  };
  bars: Array<{
    id: string;
    text?: string;
    url?: string;
    active?: boolean;
    bgColor?: string;
    textColor?: string;
    closeable?: boolean;
    position?: 'top' | 'bottom';
    [key: string]: any;
  }>;
  popups: Array<{
    id: string;
    title?: string;
    content?: string;
    active?: boolean;
    delay?: number;
    trigger?: 'load' | 'scroll' | 'exit';
    width?: string;
    showClose?: boolean;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export const floatingFallback: FloatingSettings = {
  "social": {
    "autoCloseTime": 0,
    "mobileOffsetX": 12,
    "active": true,
    "offsetY": 76,
    "offsetX": 28,
    "icons": [
      {
        "color": "#00852e",
        "bgType": "solid",
        "iconColor": "#ffffff",
        "id": "custom-1777459391300",
        "iconSize": 16,
        "bgGradient": "linear-gradient(45deg, #D4AF37, #F1D483)",
        "label": "WhatsApp",
        "active": true,
        "type": "whatsapp",
        "bgColor": "#00852e",
        "padding": 13,
        "url": "https://wa.me/+61426444449"
      }
    ],
    "position": "right-bottom",
    "instagram": {
      "active": true
    },
    "mobileOffsetY": 124
  },
  "scrollTop": {
    "active": true,
    "offset": 100,
    "mobileOffsetX": 12,
    "exceptPages": [
      ""
    ],
    "padding": 12,
    "color": "#a88100",
    "mobileOffsetY": 76,
    "iconSize": 18,
    "position": "right-bottom",
    "iconColor": "#ffffff",
    "shape": "circle",
    "displayCondition": "all",
    "offsetY": 27,
    "icon": "chevron-up",
    "offsetX": 27,
    "specificPages": [
      "/fleet"
    ]
  },
  "bars": [
    {
      "promoBg": "rgba(0,0,0,0.1)",
      "promoColor": "#000000",
      "startDate": "2026-04-23",
      "content": "<div style=\"display:flex; flex-direction:row; justify-content:center; align-items:center; gap:8px; flex-wrap:wrap; color:red; font-weight:bold;\">\n  <span>GRAND OPENING:</span>\n  <span>OFF ON ALL AIRPORT TRANSFERS!</span>\n</div>",
      "marqueeSpeed": 20,
      "autoCloseTime": 0,
      "id": "bar-1777027879724-abqokbj6e",
      "endDate": "2026-05-22",
      "delay": 0,
      "bgGradient": "linear-gradient(90deg, #D4CF37, #F1D483)",
      "name": "Summar Sale",
      "displayCondition": "specific",
      "closeColor": "#000000",
      "position": "top",
      "textColor": "#000000",
      "animation": "slide",
      "ctaLink": "/app",
      "exceptPages": [
        ""
      ],
      "showClose": true,
      "active": false,
      "ctaText": "",
      "specificPages": [
        "/booking",
        "/offers",
        "/tours"
      ],
      "bgType": "gradient",
      "promoCode": "MEL 202",
      "bgColor": "#D4AF37"
    }
  ],
  "popups": [
    {
      "title": "Summer Offer",
      "ctaText": "Get Offer",
      "endDate": "2026-05-22",
      "id": "popup-1777449387402-fx4f0hv9n",
      "delay": 500,
      "bgGradient": "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
      "name": "New Promo Popup",
      "specificPages": [
        "/tours",
        "/services",
        "/fleet"
      ],
      "bgType": "gradient",
      "subtitle": "Limited Time Only",
      "promoCode": "SUMMER15",
      "details": "Get exclusive access to our luxury fleet with 15% discount.",
      "accentColor": "#D4AF37",
      "displayCondition": "landing",
      "position": "center",
      "textColor": "#FFFFFF",
      "animation": "scale",
      "htmlContent": "<p>\n  <strong>GRAND OPENING: OFF ON ALL AIRPORT TRANSFERS!</strong>\n</p>",
      "startDate": "2026-04-29",
      "ctaLink": "/offers",
      "exceptPages": [
        "/booking",
        "/offers"
      ],
      "autoCloseTime": 5000,
      "active": false,
      "type": "sales"
    }
  ]
};
