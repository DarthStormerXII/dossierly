type Copy = {
  base(from: string, date: string): string; rule(days: number, quote: string): string;
  count(first: string, days: number, last: string): string; moved(why: string, final: string): string;
  same: string; why: { sat: string; sun: string; hol: string };
  from: { delivery: string; letter_date: string }; note: string;
};
export const extraDeadlineCopy: Record<"ru" | "zh" | "ja" | "vi", Copy> = {
  ru: {
    base: (from, date) => `Начальная дата: ${from} — ${date}.`, rule: (days, quote) => `В письме указано ${days} дней${quote ? `: «${quote}»` : ""}.`,
    count: (first, days, last) => `Начальный день не учитывается. День 1 — ${first}. При подсчёте календарных дней день ${days} — ${last}.`,
    moved: (why, final) => `Это ${why}, поэтому срок переносится на следующий рабочий день: ${final}.`, same: "Это рабочий день, дата не меняется.",
    why: { sat: "суббота", sun: "воскресенье", hol: "государственный праздник" }, from: { delivery: "вручение письма", letter_date: "дата письма" },
    note: "Это расчёт по формулировке письма, а не юридическая консультация. Подтвердите дату в учреждении.",
  },
  zh: {
    base: (from, date) => `起算点：${from}，${date}。`, rule: (days, quote) => `信中写明${days}天${quote ? `：“${quote}”` : ""}。`,
    count: (first, days, last) => `起算当天不计入。第1天为${first}。按日历天计算，第${days}天为${last}。`,
    moved: (why, final) => `该日是${why}，因此顺延至下一个工作日：${final}。`, same: "该日为工作日，日期不变。",
    why: { sat: "星期六", sun: "星期日", hol: "公共假日" }, from: { delivery: "信件送达日", letter_date: "信件日期" },
    note: "这是根据信件措辞进行的计算，并非法律建议。请向相关部门确认日期。",
  },
  ja: {
    base: (from, date) => `起算日：${from}、${date}。`, rule: (days, quote) => `手紙には${days}日と書かれています${quote ? `：「${quote}」` : ""}。`,
    count: (first, days, last) => `起算日は数えません。1日目は${first}です。暦日で数えると${days}日目は${last}です。`,
    moved: (why, final) => `その日は${why}なので、次の営業日に繰り越します：${final}。`, same: "その日は営業日なので、日付は変わりません。",
    why: { sat: "土曜日", sun: "日曜日", hol: "祝日" }, from: { delivery: "手紙の配達日", letter_date: "手紙の日付" },
    note: "これは手紙の文面に基づく計算であり、法律上の助言ではありません。担当機関に日付を確認してください。",
  },
  vi: {
    base: (from, date) => `Mốc bắt đầu: ${from}, ${date}.`, rule: (days, quote) => `Thư ghi ${days} ngày${quote ? `: “${quote}”` : ""}.`,
    count: (first, days, last) => `Không tính ngày bắt đầu. Ngày 1 là ${first}. Tính theo ngày lịch, ngày ${days} là ${last}.`,
    moved: (why, final) => `Ngày đó là ${why}, nên hạn chuyển sang ngày làm việc tiếp theo: ${final}.`, same: "Đó là ngày làm việc nên ngày không đổi.",
    why: { sat: "thứ Bảy", sun: "Chủ nhật", hol: "ngày lễ" }, from: { delivery: "ngày nhận thư", letter_date: "ngày trên thư" },
    note: "Đây là phép tính từ nội dung thư, không phải tư vấn pháp lý. Hãy xác nhận ngày với cơ quan.",
  },
};
