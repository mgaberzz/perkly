// Content of the public Privacy Policy and Terms of Use pages (/privacy, /terms).
// English and Arabic are written out in full: legal text is not translated string by string.
// Before launch, have a lawyer in Egypt review both, and fill in the company details below.

export const LEGAL = {
  company: "Perkly",
  email: "support@perkly.app",
  updated: "2026-11-08",
};

export type LegalSection = { h: string; p?: string[]; list?: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };
type Docs = { privacy: LegalDoc; terms: LegalDoc };

const { company, email } = LEGAL;

const EN: Docs = {
  privacy: {
    title: "Privacy Policy",
    intro: `${company} ("we", "us") runs the Perkly student app and the Perkly portals for merchants and partners. This policy explains what personal data we collect, why, who we share it with and the choices you have. We follow Egypt's Personal Data Protection Law (Law No. 151 of 2020).`,
    sections: [
      {
        h: "1. What we collect",
        list: [
          "Account details: your phone number or email, name, birth date, university or campus, and the student and user IDs we assign to you.",
          "Student ID: a photo of your student ID card and, if you add it, your student number, to confirm you are a student. Only Perkly's operations team can see it.",
          "Profile picture: a photo you upload, or the cartoon avatar you build. Both are optional and you can remove them at any time.",
          "Redemptions: each discount you use, the merchant and branch, the bill amount, the discount, the time, the transaction ID and how you paid.",
          "Location: when you allow it, your phone's location is used to show nearby perks, and at the moment you redeem to confirm you are at the shop. We store the redemption's distance check, not a history of where you go.",
          "Payments: when you pay in the app, the payment provider handles your card details. We receive only the result (paid or failed), the amount and a reference. We never see or store your full card number.",
          "Device and usage: app version, device type, language, crash reports and basic usage, to keep the service working and secure.",
          "Merchant and partner portals: business details, team members' names and work emails, branches, bank details for settlements, and activity in the portal.",
        ],
      },
      {
        h: "2. What we do not collect",
        list: [
          "Face ID, fingerprint and passkeys stay on your device. We receive a yes/no confirmation or a public key, never your face or fingerprint.",
          "We do not read your contacts, messages or photos other than the one picture you choose to upload.",
        ],
      },
      {
        h: "3. Why we use it",
        list: [
          "To create your account, confirm you are a student and keep you signed in.",
          "To show perks near you and on your campus, apply discounts and stop misuse (for example, daily limits and in-store checks).",
          "To settle money with merchants and partners, keep financial records and meet tax and accounting rules.",
          "To send service messages (sign-in codes, receipts, account notices).",
          "To send perk drops and flash deals, only if you opted in. You can switch this off in Settings at any time.",
          "To improve the app with aggregated statistics that do not identify you.",
        ],
      },
      {
        h: "4. Who we share it with",
        p: ["We never sell your personal data. We share only what is needed:"],
        list: [
          "Merchants see the redemption at their shop: the transaction ID, the time, the amounts and the verification code. They do not see your phone number, email or birth date.",
          "Partners who onboarded a merchant see totals and transaction IDs for that merchant, with no student details.",
          "Service providers that run Perkly for us under contract: hosting and database (Supabase), the web host (Vercel), SMS and email delivery, the payment provider and crash reporting. Some of them store data outside Egypt; we use providers that protect it to a standard comparable to Egyptian law.",
          "Authorities, when the law requires it, or to protect users, merchants or Perkly from fraud.",
        ],
      },
      {
        h: "5. How long we keep it",
        list: [
          "Your account data is kept while your account is open.",
          "Redemption and payment records are kept for as long as tax and accounting law requires (usually up to 5 years), even after you close your account, but they are no longer linked to your profile in the app.",
          "Photos and avatars are deleted as soon as you remove them or close your account.",
          "Student ID photos are kept while your account is open, so we can show that your verification was checked, and are deleted when you delete your account.",
        ],
      },
      {
        h: "6. Your rights",
        p: [
          "You can see and edit your profile in the app at any time. You can delete your account yourself in Me → Settings → Delete account: your personal data is erased straight away and your past transactions are kept only without your name or contact details. You can also ask us to give you a copy of your data, correct it, or stop using it for marketing. Email us at " + email + " from the phone number or email on your account and we will reply within 30 days.",
          "If you are not satisfied with our answer, you can complain to Egypt's Personal Data Protection Center.",
        ],
      },
      {
        h: "7. Security",
        p: ["Data is encrypted in transit, access is limited by role (a merchant only sees its own shop; our team members only see what their job needs), and we log sensitive actions. No system is perfectly secure; if a breach affects you, we will tell you and the authorities as the law requires."],
      },
      {
        h: "8. Children",
        p: ["Perkly is for university students. You must be at least 16 to use it; if you are under 18, you confirm a parent or guardian agrees."],
      },
      {
        h: "9. Changes",
        p: ["If we change this policy we will update the date at the top and, for important changes, tell you in the app before they take effect."],
      },
      {
        h: "10. Contact",
        p: [`${company} · ${email}`],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    intro: `These terms are an agreement between you and ${company}. By creating an account or using the Perkly app or portals you agree to them. Please read them together with our Privacy Policy.`,
    sections: [
      {
        h: "1. Who can use Perkly",
        list: [
          "The student app is for students currently enrolled at a university or institute in Egypt, aged 16 or older.",
          "One account per person. Your account, IDs and redemption codes are personal: do not share, sell or transfer them.",
          "The information you give us (name, campus, student status) must be true. We may ask for proof that you are a student.",
        ],
      },
      {
        h: "2. Perks and discounts",
        list: [
          "Perks are offered by the merchants, not by Perkly. Each perk shows its own conditions (minimum spend, days, branches, limits).",
          "A perk is valid only at the participating branch, while it is active, and within any daily or total limits.",
          "Merchants may change or end a perk. We try to keep the app up to date but cannot guarantee that every perk is available at every moment.",
          "The quality of products and services is the merchant's responsibility. Complaints about a purchase go to the merchant first; we will help where we can.",
        ],
      },
      {
        h: "3. Redeeming",
        list: [
          "Redeem in the shop by scanning the merchant's Perkly QR code and showing the confirmation screen to the cashier.",
          "A redemption must match a real purchase. Fake bill amounts, redeeming for someone else, using screenshots or tricking the location check is not allowed.",
          "If a redemption was made by mistake, ask the cashier or contact us; a merchant or our team may reverse it.",
        ],
      },
      {
        h: "4. Payments in the app",
        list: [
          "When you pay in the app, the payment is processed by our payment provider and the amount shown on the confirmation is what you pay.",
          "Refunds follow the merchant's refund policy and are returned to the original payment method.",
        ],
      },
      {
        h: "5. Your account",
        list: [
          "Keep your phone, sign-in codes and device lock secure. You are responsible for activity on your account.",
          "You can delete your account at any time in the app: Me → Settings → Delete account.",
          "We may suspend or close an account that breaks these terms, abuses perks or harms merchants or other users.",
        ],
      },
      {
        h: "6. Content you add",
        p: ["You own the photo you upload. You allow us to store and show it in the app as your profile picture. Do not upload anything offensive, illegal or that belongs to someone else."],
      },
      {
        h: "7. Merchants and partners",
        p: ["Merchants and partners use the portals under these terms and their signed agreement with Perkly. If the two differ, the signed agreement wins on commercial matters (commission, settlements and partner cuts)."],
      },
      {
        h: "8. Perkly's content",
        p: ["The Perkly name, logo, mascot, app and portals belong to us. You may not copy them, scrape the app or try to break its security."],
      },
      {
        h: "9. Liability",
        p: [
          "We provide Perkly \"as is\". We work hard to keep it running but do not promise it will always be available or error-free.",
          "To the extent the law allows, we are not responsible for indirect losses or for a merchant's products, services or refusal to honour a perk. Nothing in these terms limits rights you have under Egypt's Consumer Protection Law.",
        ],
      },
      {
        h: "10. Changes and ending",
        p: ["We may update these terms. For important changes we will tell you in the app before they take effect; if you keep using Perkly after that, you accept the new terms. You can stop using Perkly at any time."],
      },
      {
        h: "11. Law",
        p: ["These terms are governed by the laws of the Arab Republic of Egypt. Disputes go to the courts of Cairo, after first trying to solve them with us directly."],
      },
      {
        h: "12. Contact",
        p: [`${company} · ${email}`],
      },
    ],
  },
};

const AR: Docs = {
  privacy: {
    title: "سياسة الخصوصية",
    intro: `تدير ${company} ("نحن") تطبيق Perkly للطلاب وبوابات Perkly للتجار والشركاء. توضح هذه السياسة البيانات الشخصية التي نجمعها، ولماذا، ومع من نشاركها، والخيارات المتاحة لك. نلتزم بقانون حماية البيانات الشخصية المصري (القانون رقم 151 لسنة 2020).`,
    sections: [
      {
        h: "١. ما نجمعه",
        list: [
          "بيانات الحساب: رقم هاتفك أو بريدك الإلكتروني، واسمك، وتاريخ ميلادك، وجامعتك أو الحرم الجامعي، ورقم الطالب ورقم المستخدم اللذين نخصصهما لك.",
          "كارنيه الطالب: صورة كارنيه الطالب، والرقم الجامعي إذا أضفته، للتأكد من أنك طالب. لا يراها إلا فريق العمليات في Perkly.",
          "صورة الملف الشخصي: صورة ترفعها أو الأفاتار الكرتوني الذي تصممه. كلاهما اختياري ويمكنك حذفه في أي وقت.",
          "عمليات الاستخدام: كل خصم تستخدمه، والتاجر والفرع، ومبلغ الفاتورة، والخصم، والوقت، ورقم المعاملة، وطريقة الدفع.",
          "الموقع: عند سماحك بذلك، نستخدم موقع هاتفك لعرض العروض القريبة، ولحظة استخدام الخصم للتأكد من وجودك في المتجر. نحتفظ بنتيجة التحقق من المسافة فقط، وليس بسجل لأماكن تنقلك.",
          "المدفوعات: عند الدفع داخل التطبيق، يتولى مزود خدمة الدفع بيانات بطاقتك. نستلم فقط النتيجة (تم الدفع أو فشل) والمبلغ ومرجع العملية، ولا نرى رقم بطاقتك الكامل ولا نخزنه.",
          "الجهاز والاستخدام: إصدار التطبيق، ونوع الجهاز، واللغة، وتقارير الأعطال، وبيانات استخدام أساسية، للحفاظ على عمل الخدمة وأمانها.",
          "بوابات التجار والشركاء: بيانات النشاط التجاري، وأسماء أعضاء الفريق وبريدهم الإلكتروني للعمل، والفروع، والبيانات البنكية للتسويات، والنشاط داخل البوابة.",
        ],
      },
      {
        h: "٢. ما لا نجمعه",
        list: [
          "بصمة الوجه وبصمة الإصبع ومفاتيح المرور تبقى على جهازك. نستلم تأكيدًا بنعم أو لا أو مفتاحًا عامًا فقط، وليس صورة وجهك أو بصمتك.",
          "لا نقرأ جهات اتصالك أو رسائلك أو صورك، باستثناء الصورة الوحيدة التي تختار رفعها.",
        ],
      },
      {
        h: "٣. لماذا نستخدمها",
        list: [
          "لإنشاء حسابك، والتأكد من أنك طالب، والإبقاء على تسجيل دخولك.",
          "لعرض العروض القريبة منك وفي حرمك الجامعي، وتطبيق الخصومات، ومنع إساءة الاستخدام (مثل الحدود اليومية والتحقق من التواجد في المتجر).",
          "لتسوية المبالغ مع التجار والشركاء، والاحتفاظ بالسجلات المالية، والالتزام بقواعد الضرائب والمحاسبة.",
          "لإرسال رسائل الخدمة (رموز تسجيل الدخول، والإيصالات، وإشعارات الحساب).",
          "لإرسال العروض الجديدة والعروض السريعة، فقط إذا وافقت على ذلك. يمكنك إيقافها من الإعدادات في أي وقت.",
          "لتحسين التطبيق باستخدام إحصاءات مجمّعة لا تكشف هويتك.",
        ],
      },
      {
        h: "٤. مع من نشاركها",
        p: ["لا نبيع بياناتك الشخصية أبدًا. نشارك فقط ما هو ضروري:"],
        list: [
          "يرى التاجر عملية الاستخدام في متجره: رقم المعاملة، والوقت، والمبالغ، ورمز التحقق. لا يرى رقم هاتفك أو بريدك الإلكتروني أو تاريخ ميلادك.",
          "يرى الشريك الذي ضم تاجرًا إجماليات وأرقام معاملات هذا التاجر، دون أي بيانات عن الطلاب.",
          "مزودو الخدمات الذين يشغّلون Perkly لصالحنا بموجب عقود: الاستضافة وقاعدة البيانات (Supabase)، واستضافة الموقع (Vercel)، وإرسال الرسائل النصية والبريد، ومزود الدفع، وتقارير الأعطال. يخزن بعضهم البيانات خارج مصر، ونختار مزودين يحمونها بمستوى مماثل لما يتطلبه القانون المصري.",
          "الجهات الرسمية عندما يتطلب القانون ذلك، أو لحماية المستخدمين أو التجار أو Perkly من الاحتيال.",
        ],
      },
      {
        h: "٥. مدة الاحتفاظ",
        list: [
          "نحتفظ ببيانات حسابك طالما حسابك مفتوح.",
          "نحتفظ بسجلات الاستخدام والمدفوعات للمدة التي تتطلبها قوانين الضرائب والمحاسبة (عادةً حتى 5 سنوات)، حتى بعد إغلاق حسابك، لكنها لا تعود مرتبطة بملفك في التطبيق.",
          "تُحذف الصور والأفاتار فور إزالتها أو إغلاق حسابك.",
          "نحتفظ بصورة كارنيه الطالب طالما حسابك مفتوح لإثبات أنه تمت مراجعة التوثيق، وتُحذف عند حذف حسابك.",
        ],
      },
      {
        h: "٦. حقوقك",
        p: [
          "يمكنك عرض ملفك الشخصي وتعديله في التطبيق في أي وقت. ويمكنك حذف حسابك بنفسك من حسابي ← الإعدادات ← حذف الحساب: تُحذف بياناتك الشخصية فورًا، وتبقى معاملاتك السابقة دون اسمك أو بيانات التواصل معك. ويمكنك أيضًا أن تطلب منا نسخة من بياناتك، أو تصحيحها، أو التوقف عن استخدامها للتسويق. راسلنا على " + email + " من رقم الهاتف أو البريد المسجل في حسابك، وسنرد خلال 30 يومًا.",
          "إذا لم يرضك ردنا، يمكنك تقديم شكوى إلى مركز حماية البيانات الشخصية في مصر.",
        ],
      },
      {
        h: "٧. الأمان",
        p: ["البيانات مشفرة أثناء نقلها، والوصول إليها محدود حسب الدور (التاجر يرى متجره فقط، وأعضاء فريقنا يرون ما يحتاجه عملهم فقط)، ونسجل الإجراءات الحساسة. لا يوجد نظام آمن تمامًا؛ وإذا تأثرت بأي اختراق، سنبلغك ونبلغ الجهات المختصة وفقًا للقانون."],
      },
      {
        h: "٨. صغار السن",
        p: ["Perkly مخصص لطلاب الجامعات. يجب ألا يقل عمرك عن 16 عامًا، وإذا كان عمرك أقل من 18 عامًا فأنت تؤكد موافقة ولي أمرك."],
      },
      {
        h: "٩. التغييرات",
        p: ["إذا غيّرنا هذه السياسة سنحدّث التاريخ في أعلى الصفحة، وفي التغييرات المهمة سنبلغك داخل التطبيق قبل سريانها."],
      },
      {
        h: "١٠. التواصل",
        p: [`${company} · ${email}`],
      },
    ],
  },
  terms: {
    title: "شروط الاستخدام",
    intro: `هذه الشروط اتفاق بينك وبين ${company}. بإنشاء حساب أو استخدام تطبيق Perkly أو بواباته فإنك توافق عليها. يُرجى قراءتها مع سياسة الخصوصية.`,
    sections: [
      {
        h: "١. من يمكنه استخدام Perkly",
        list: [
          "تطبيق الطلاب مخصص للطلاب المقيدين حاليًا في جامعة أو معهد في مصر، ممن لا تقل أعمارهم عن 16 عامًا.",
          "حساب واحد لكل شخص. حسابك وأرقامك ورموز الاستخدام شخصية: لا تشاركها ولا تبعها ولا تنقلها لغيرك.",
          "يجب أن تكون البيانات التي تقدمها (الاسم، والحرم الجامعي، وصفة الطالب) صحيحة، وقد نطلب إثباتًا لكونك طالبًا.",
        ],
      },
      {
        h: "٢. العروض والخصومات",
        list: [
          "يقدم التجار العروض، وليس Perkly. لكل عرض شروطه الخاصة (حد أدنى للإنفاق، أيام، فروع، حدود).",
          "العرض صالح فقط في الفرع المشارك، وطالما كان مفعّلًا، وفي حدود الاستخدام اليومية أو الإجمالية.",
          "قد يغيّر التاجر العرض أو ينهيه. نحاول تحديث التطبيق باستمرار لكن لا نضمن توفر كل عرض في كل لحظة.",
          "جودة المنتجات والخدمات مسؤولية التاجر. تُوجَّه الشكاوى عن أي عملية شراء إلى التاجر أولًا، وسنساعد قدر الإمكان.",
        ],
      },
      {
        h: "٣. استخدام الخصم",
        list: [
          "استخدم الخصم في المتجر بمسح رمز QR الخاص بالتاجر على Perkly وإظهار شاشة التأكيد للكاشير.",
          "يجب أن يطابق الاستخدام عملية شراء حقيقية. يُمنع إدخال مبالغ فواتير غير حقيقية، أو الاستخدام لصالح شخص آخر، أو استخدام لقطات الشاشة، أو التحايل على التحقق من الموقع.",
          "إذا تم الاستخدام عن طريق الخطأ، اطلب من الكاشير أو تواصل معنا؛ ويمكن للتاجر أو لفريقنا إلغاؤه.",
        ],
      },
      {
        h: "٤. الدفع داخل التطبيق",
        list: [
          "عند الدفع داخل التطبيق، يعالج مزود الدفع العملية، والمبلغ الظاهر في شاشة التأكيد هو ما تدفعه.",
          "يخضع الاسترداد لسياسة التاجر، ويُعاد المبلغ إلى وسيلة الدفع الأصلية.",
        ],
      },
      {
        h: "٥. حسابك",
        list: [
          "حافظ على أمان هاتفك ورموز تسجيل الدخول وقفل جهازك. أنت مسؤول عن النشاط الذي يتم من خلال حسابك.",
          "يمكنك حذف حسابك في أي وقت من التطبيق: حسابي ← الإعدادات ← حذف الحساب.",
          "قد نوقف أو نغلق أي حساب يخالف هذه الشروط أو يسيء استخدام العروض أو يضر بالتجار أو المستخدمين الآخرين.",
        ],
      },
      {
        h: "٦. المحتوى الذي تضيفه",
        p: ["الصورة التي ترفعها ملكك، وتسمح لنا بتخزينها وعرضها في التطبيق كصورة لملفك الشخصي. لا ترفع أي محتوى مسيء أو مخالف للقانون أو مملوك لغيرك."],
      },
      {
        h: "٧. التجار والشركاء",
        p: ["يستخدم التجار والشركاء البوابات وفق هذه الشروط واتفاقهم الموقّع مع Perkly. وعند وجود اختلاف بينهما، يسري الاتفاق الموقّع في المسائل التجارية (العمولة، والتسويات، ونصيب الشركاء)."],
      },
      {
        h: "٨. محتوى Perkly",
        p: ["اسم Perkly وشعاره والشخصية الكرتونية والتطبيق والبوابات ملك لنا. لا يجوز نسخها أو استخراج بيانات التطبيق آليًا أو محاولة اختراق أمانه."],
      },
      {
        h: "٩. المسؤولية",
        p: [
          "نقدم Perkly \"كما هو\". نعمل جاهدين لاستمرار تشغيله، لكننا لا نتعهد بأن يكون متاحًا دائمًا أو خاليًا من الأخطاء.",
          "في الحدود التي يسمح بها القانون، لسنا مسؤولين عن الخسائر غير المباشرة أو عن منتجات التاجر أو خدماته أو رفضه تطبيق أي عرض. لا يحدّ أي شيء في هذه الشروط من حقوقك وفقًا لقانون حماية المستهلك المصري.",
        ],
      },
      {
        h: "١٠. التغييرات وإنهاء الاستخدام",
        p: ["قد نحدّث هذه الشروط. في التغييرات المهمة سنبلغك داخل التطبيق قبل سريانها، واستمرارك في استخدام Perkly بعد ذلك يعني قبولك للشروط الجديدة. يمكنك التوقف عن استخدام Perkly في أي وقت."],
      },
      {
        h: "١١. القانون",
        p: ["تخضع هذه الشروط لقوانين جمهورية مصر العربية، وتختص محاكم القاهرة بأي نزاع، بعد محاولة حله معنا وديًا أولًا."],
      },
      {
        h: "١٢. التواصل",
        p: [`${company} · ${email}`],
      },
    ],
  },
};

export const legalDoc = (kind: keyof Docs, lang: "en" | "ar") => (lang === "ar" ? AR : EN)[kind];
