import Document, { Head, Html, Main, NextScript } from "next/document";

const BODY_BY_ROUTE = {
  "/": {
    className: "page page-home",
    "data-i18n-page": "index",
  },
  "/item-user": {
    className: "page page-user ik-auth-pending",
    "data-ik-loading": "true",
  },
  "/item-crate": {
    className: "page page-crate ik-booting",
    "data-ik-loading": "true",
  },
  "/crate/onoi_notes": {
    className: "page page-crate onoi-booting",
    "data-i18n-page": "onoi_notes",
    "data-ik-loading": "true",
  },
  "/crate/planning": {
    className: "page page-planning ik-booting",
    "data-i18n-page": "planning",
    "data-ik-loading": "true",
  },
  "/crate/schedule": {
    className: "page page-schedule ik-booting",
    "data-ik-loading": "true",
  },
  "/crate/student_helper": {
    className: "page page-learning ik-booting",
    "data-i18n-page": "student_helper",
    "data-ik-loading": "true",
  },
  "/crate/whisperer": {
    className: "page page-crate",
    "data-i18n-page": "whisperer",
  },
};

export default class MyDocument extends Document {
  render() {
    const route = String(this.props?.__NEXT_DATA__?.page || "/");
    const attrs = BODY_BY_ROUTE[route] || {};
    const className = attrs.className || "page";

    const bodyDataAttrs = Object.keys(attrs).reduce((acc, key) => {
      if (key === "className") return acc;
      acc[key] = attrs[key];
      return acc;
    }, {});

    return (
      <Html lang="ru">
        <Head />
        <body className={className} {...bodyDataAttrs}>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
