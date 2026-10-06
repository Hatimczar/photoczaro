/*
 * Translated <title>/description for each static page, used when a page is
 * served under a language prefix (/fr/about, /ar/, ...). Without this a
 * translated URL would show search engines the English head, which is why
 * translated pages also need their own canonical (see localizeHead).
 * English lives in the HTML files themselves.
 */
export const PAGE_META = {
  home: {
    fr: ["Photoczaro Models | Réservation de mannequins aux EAU", "Réservez des mannequins basés aux Émirats pour vos productions éditoriales, mode, beauté et commerciales. Un registre sélectionné et non exclusif, à Dubaï et dans tout le pays."],
    ru: ["Photoczaro Models | Бронирование моделей в ОАЭ", "Бронируйте моделей из ОАЭ для редакционных, модных, бьюти и коммерческих съёмок. Отобранный реестр без эксклюзивности в Дубае и по всей стране."],
    es: ["Photoczaro Models | Reserva de modelos en los EAU", "Reserva modelos residentes en los EAU para producciones editoriales, de moda, belleza y comerciales. Un roster seleccionado y no exclusivo en Dubái y todo el país."],
    cs: ["Photoczaro Models | Rezervace modelů v SAE", "Rezervujte modely působící v SAE pro editoriální, módní, beauty i komerční produkce. Vybraný nevýhradní seznam v Dubaji i po celé zemi."],
    ar: ["Photoczaro Models | حجز عارضين في الإمارات", "احجز عارضين مقيمين في الإمارات لإنتاجات التحرير والأزياء والجمال والإعلانات. قائمة منتقاة وغير حصرية في دبي وكل أنحاء الدولة."],
  },
  models: {
    fr: ["Mannequins aux EAU pour projets éditoriaux et commerciaux | Photoczaro", "Parcourez le registre Photoczaro de mannequins basés aux EAU. Filtrez par catégorie, lieu, taille et compétences, puis constituez une présélection."],
    ru: ["Модели в ОАЭ для редакционных и коммерческих съёмок | Photoczaro", "Изучите реестр Photoczaro: модели из ОАЭ. Фильтруйте по категории, городу, росту и навыкам и соберите подборку для бронирования."],
    es: ["Modelos en los EAU para encargos editoriales y comerciales | Photoczaro", "Explora el roster de Photoczaro con modelos en los EAU. Filtra por categoría, ubicación, altura y habilidades y crea tu preselección."],
    cs: ["Modely v SAE pro editoriální a komerční zakázky | Photoczaro", "Projděte seznam modelů Photoczaro působících v SAE. Filtrujte podle kategorie, lokality, výšky a dovedností a sestavte si výběr."],
    ar: ["عارضون في الإمارات للتحرير والإعلانات | Photoczaro", "تصفّح قائمة Photoczaro للعارضين في الإمارات. صفِّ حسب الفئة والموقع والطول والمهارات ثم كوّن قائمتك المختصرة للحجز."],
  },
  "book-talent": {
    fr: ["Réserver un mannequin | Photoczaro Models Dubaï", "Envoyez une demande de réservation pour un ou plusieurs mannequins Photoczaro. Disponibilités et devis suivent généralement sous un jour ouvré."],
    ru: ["Забронировать модель | Photoczaro Models Дубай", "Отправьте запрос на бронирование одной или нескольких моделей Photoczaro. Наличие и расчёт стоимости обычно присылаем в течение одного рабочего дня."],
    es: ["Reservar modelo | Photoczaro Models Dubái", "Envía una solicitud de reserva para uno o varios modelos de Photoczaro. La disponibilidad y el presupuesto suelen llegar en un día hábil."],
    cs: ["Rezervovat modelku | Photoczaro Models Dubaj", "Odešlete poptávku na jednu či více modelek a modelů Photoczaro. Dostupnost a nabídka obvykle následují do jednoho pracovního dne."],
    ar: ["احجز عارضًا | Photoczaro Models دبي", "أرسل طلب حجز لعارض واحد أو أكثر من Photoczaro. يصلك عادةً التأكيد على التوفر وعرض السعر خلال يوم عمل واحد."],
  },
  apply: {
    fr: ["Rejoindre le registre | Photoczaro Models Dubaï", "Candidatez au registre Photoczaro. Réservé aux résidents des EAU de 18 ans et plus. Représentation non exclusive, sans frais de candidature."],
    ru: ["Подать заявку в реестр | Photoczaro Models Дубай", "Подайте заявку в реестр Photoczaro. Только резиденты ОАЭ от 18 лет. Представительство без эксклюзивности, без платы за заявку."],
    es: ["Solicitar entrada al roster | Photoczaro Models Dubái", "Solicita entrar en el roster de Photoczaro. Solo residentes en los EAU mayores de 18 años. Representación no exclusiva y sin coste de solicitud."],
    cs: ["Přihláška do seznamu | Photoczaro Models Dubaj", "Přihlaste se do seznamu Photoczaro. Pouze rezidenti SAE starší 18 let. Nevýhradní zastupování, bez poplatku za přihlášku."],
    ar: ["التقديم إلى القائمة | Photoczaro Models دبي", "قدّم طلبك للانضمام إلى قائمة Photoczaro. للمقيمين في الإمارات فوق 18 عامًا فقط. تمثيل غير حصري وبدون رسوم تقديم."],
  },
  about: {
    fr: ["À propos | Photoczaro Models Dubaï", "Un registre de réservation sélectionné et non exclusif de mannequins adultes résidant aux EAU, avec gestion des réservations de bout en bout."],
    ru: ["О нас | Photoczaro Models Дубай", "Отобранный реестр без эксклюзивности для совершеннолетних моделей-резидентов ОАЭ. Представляем таланты клиентам и ведём бронирование от и до."],
    es: ["Acerca de | Photoczaro Models Dubái", "Un roster de reservas seleccionado y no exclusivo de modelos adultos residentes en los EAU, con gestión de las reservas de principio a fin."],
    cs: ["O nás | Photoczaro Models Dubaj", "Vybraný nevýhradní rezervační seznam dospělých modelů s pobytem v SAE. Představujeme talenty klientům a řídíme rezervace od začátku do konce."],
    ar: ["من نحن | Photoczaro Models دبي", "قائمة حجز منتقاة وغير حصرية للعارضين البالغين المقيمين في الإمارات، نقدّم المواهب للعملاء وندير الحجوزات من البداية إلى النهاية."],
  },
  contact: {
    fr: ["Contact | Photoczaro Models Dubaï", "Contactez Photoczaro Models à Dubaï pour une demande de réservation, une candidature au registre ou toute autre question."],
    ru: ["Контакты | Photoczaro Models Дубай", "Свяжитесь с Photoczaro Models в Дубае по вопросам бронирования, заявок в реестр и любым другим вопросам."],
    es: ["Contacto | Photoczaro Models Dubái", "Contacta con Photoczaro Models en Dubái para consultas de reserva, solicitudes al roster o cualquier otra pregunta."],
    cs: ["Kontakt | Photoczaro Models Dubaj", "Kontaktujte Photoczaro Models v Dubaji ohledně poptávek na rezervaci, přihlášek do seznamu nebo jakýchkoli dotazů."],
    ar: ["اتصل بنا | Photoczaro Models دبي", "تواصل مع Photoczaro Models في دبي بشأن طلبات الحجز أو التقديم إلى القائمة أو أي استفسار آخر."],
  },
  "booking-terms": {
    fr: ["Conditions de réservation | Photoczaro Models Dubaï", "Conditions applicables aux demandes et réservations de talents via Photoczaro Models, en vigueur au 29 septembre 2026."],
    ru: ["Условия бронирования | Photoczaro Models Дубай", "Условия, регулирующие запросы и бронирование талантов через Photoczaro Models. Действуют с 29 сентября 2026 года."],
    es: ["Condiciones de reserva | Photoczaro Models Dubái", "Condiciones que regulan las consultas y reservas de talento a través de Photoczaro Models, vigentes desde el 29 de septiembre de 2026."],
    cs: ["Rezervační podmínky | Photoczaro Models Dubaj", "Podmínky upravující poptávky a rezervace talentů přes Photoczaro Models, účinné od 29. září 2026."],
    ar: ["شروط الحجز | Photoczaro Models دبي", "الشروط التي تحكم طلبات الحجز والحجوزات عبر Photoczaro Models، سارية اعتبارًا من 29 سبتمبر 2026."],
  },
  "privacy-policy": {
    fr: ["Politique de confidentialité | Photoczaro Models Dubaï", "Comment Photoczaro Models collecte, utilise, conserve et partage les données personnelles. En vigueur au 29 septembre 2026."],
    ru: ["Политика конфиденциальности | Photoczaro Models Дубай", "Как Photoczaro Models собирает, использует, хранит и передаёт персональные данные. Действует с 29 сентября 2026 года."],
    es: ["Política de privacidad | Photoczaro Models Dubái", "Cómo Photoczaro Models recoge, usa, conserva y comparte datos personales. Vigente desde el 29 de septiembre de 2026."],
    cs: ["Zásady ochrany osobních údajů | Photoczaro Models Dubaj", "Jak Photoczaro Models shromažďuje, používá, uchovává a sdílí osobní údaje. Účinné od 29. září 2026."],
    ar: ["سياسة الخصوصية | Photoczaro Models دبي", "كيف تجمع Photoczaro Models البيانات الشخصية وتستخدمها وتحفظها وتشاركها. سارية اعتبارًا من 29 سبتمبر 2026."],
  },
};

const ORIGIN = "https://models.photoczaro.com";

/* Rewrites the head of a language-prefixed static page: its own canonical and
   og:url (so the translations are indexable instead of being folded into the
   English page), the right <html lang>/dir, and the translated title and
   description. */
export function localizeHead(rewriter, lang, pageKey) {
  const path = pageKey === "home" ? `/${lang}/` : `/${lang}/${pageKey}`;
  const meta = PAGE_META[pageKey]?.[lang];
  const attr = (name, value) => ({ element(el) { el.setAttribute(name, value); } });
  rewriter = rewriter
    .on("html", { element(el) { el.setAttribute("lang", lang); el.setAttribute("dir", lang === "ar" ? "rtl" : "ltr"); } })
    .on('link[rel="canonical"]', attr("href", ORIGIN + path))
    .on('meta[property="og:url"]', attr("content", ORIGIN + path))
    .on('meta[property="og:locale"]', attr("content", lang));
  if (meta) {
    const [title, desc] = meta;
    rewriter = rewriter
      .on("title", { element(el) { el.setInnerContent(title); } })
      .on('meta[name="description"]', attr("content", desc))
      .on('meta[property="og:title"]', attr("content", title))
      .on('meta[property="og:description"]', attr("content", desc))
      .on('meta[name="twitter:title"]', attr("content", title))
      .on('meta[name="twitter:description"]', attr("content", desc));
  }
  return rewriter;
}
