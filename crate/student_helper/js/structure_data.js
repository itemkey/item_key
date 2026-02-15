(function(){
  // Global registry (no modules, simple static hosting)
  const USED_TO = {
    id: "used-to",
    title: "USED TO",
    subtitle: "Past habits vs being accustomed",
    ruleBlocks: [
      { type: "heading", text: "Главная карта различий" },
      { type: "text", text: "USED TO конструкции в английском языке." },
      {
        type: "table",
        caption: "USED TO - быстрый обзор",
        columns: ["Конструкция", "Что описывает?", "Время", "Форма глагола", "Перевод"],
        rows: [
          ["used to + infinitive", "Прошлая привычка или состояние, которого больше нет", "Только прошлое", "Инфинитив", "Раньше (делал что-то)"],
          ["be used to + V-ing / Noun", "Текущее состояние: уже привык, это для меня норма", "Любое время", "Герундий (-ing) или существительное", "Привык (к чему-то)"],
          ["get used to + V-ing / Noun", "Процесс привыкания, переход от 'не привык' к 'привык'", "Любое время", "Герундий (-ing) или существительное", "Привыкать / Привыкнуть"],
          ["become used to + V-ing / Noun", "Формальный/постепенный процесс привыкания", "Любое время, чаще Past/Perfect", "Герундий (-ing) или существительное", "Постепенно привыкать"]
        ]
      },

      { type: "heading", text: "1) used to + V1" },
      { type: "text", text: "Прошлая привычка/состояние: было раньше, но сейчас уже нет." },
      { type: "examples", items: [
        { en: "I used to live in a village.", ru: "Раньше я жил(а) в деревне (сейчас - нет)." },
        { en: "He used to be shy.", ru: "Раньше он был стеснительным (сейчас - нет)." }
      ]},

      { type: "heading", text: "2) be used to + V-ing / Noun" },
      { type: "text", text: "Текущее состояние: 'привык', это нормально." },
      { type: "examples", items: [
        { en: "I am used to noise.", ru: "Я привык(ла) к шуму." },
        { en: "I am used to working late.", ru: "Я привык(ла) работать допоздна." }
      ]},

      { type: "heading", text: "3) get used to + V-ing / Noun" },
      { type: "text", text: "Процесс привыкания: 'привыкаю'." },
      { type: "examples", items: [
        { en: "I am getting used to the cold.", ru: "Я привыкаю к холоду." },
        { en: "You will get used to living here.", ru: "Ты привыкнешь жить здесь." }
      ]},

      { type: "highlight", title: "Вопросы и отрицания", lines: [
        "Отрицание (used to): didn't use to (не didn't used to)",
        "Вопрос: Did you use to...?",
        "Не путай: used to + V1 vs be/get used to + V-ing"
      ]},

      { type: "highlight", title: "Типовые ошибки", lines: [
        "used to + V-ing - неправильно",
        "be used to + infinitive - неправильно",
        "путаница meaning: 'раньше делал' vs 'привык'"
      ]}
    ],

    practice: {
      exercises: [
        {
          id: "ex1",
          title: "used to / be used to / get used to (Choice)",
          kind: "choice",
          items: [
            { id: "ex1q1", instruction: "Choose the correct variant", prompt: "I ________ live in a small village, but now I live in the city.", options: ["am used to", "used to", "get used to"], correctIndex: 1 },
            { id: "ex1q2", instruction: "Choose the correct variant", prompt: "The noise is terrible, but I ________ it. I've lived near the airport for years.", options: ["am used to", "used to", "get used to"], correctIndex: 0 },
            { id: "ex1q3", instruction: "Choose the correct variant", prompt: "She found the new software confusing at first, but she quickly ________ it.", options: ["is used to", "got used to", "used to"], correctIndex: 1 },
            { id: "ex1q4", instruction: "Choose the correct variant", prompt: "He ________ play football every weekend when he was younger.", options: ["is used to", "gets used to", "used to"], correctIndex: 2 },
            { id: "ex1q5", instruction: "Choose the correct variant", prompt: "It might be difficult to ________ the cold weather if you move to Norway.", options: ["be used to", "get used to", "used to"], correctIndex: 1 },
            { id: "ex1q6", instruction: "Choose the correct variant", prompt: "They ________ working long hours. It's normal in their profession.", options: ["are used to", "got used to", "use to"], correctIndex: 0 }
          ]
        },
        {
          id: "ex2",
          title: "Open the brackets (Input)",
          kind: "input",
          items: [
            { id: "ex2q1", mode: "fragment", instruction: "Open the brackets, put the verb in the correct form", prompt: "I ________ (drink) a lot of coffee, but now I prefer tea.", accepted: ["used to drink"] },
            { id: "ex2q2", mode: "fragment", instruction: "Open the brackets, put the verb in the correct form", prompt: "My grandfather ________ (not/use) computers. He finds them complicated.", accepted: ["didn't use to", "did not use to"] },
            { id: "ex2q3", mode: "fragment", instruction: "Open the brackets, put the verb in the correct form", prompt: "Moving to a new country is hard, but you will ________ (live) there.", accepted: ["get used to living"] },
            { id: "ex2q4", mode: "fragment", instruction: "Open the brackets, put the verb in the correct form", prompt: "I can't ________ (wake up) so early. I need more sleep!", accepted: ["get used to waking up"] }
          ]
        },
        {
          id: "ex3",
          title: "Paraphrase (Input)",
          kind: "input",
          items: [
            { id: "ex3q1", mode: "fragment", instruction: "Paraphrase the sentences", prompt: "He doesn't mind the chaos of the city anymore. He has lived here for ten years. -> He ________ the chaos of the city now.", accepted: ["is used to"] },
            { id: "ex3q2", mode: "fragment", instruction: "Paraphrase the sentences", prompt: "It was difficult for her to wake up at 6 a.m., but now it's easy. -> She ________ at 6 a.m.", accepted: ["has got used to waking up", "has gotten used to waking up", "is used to waking up"] },
            { id: "ex3q3", mode: "fragment", instruction: "Paraphrase the sentences", prompt: "When I was a child, we went to the seaside every summer. -> We ________ to the seaside every summer.", accepted: ["used to go"] },
            { id: "ex3q4", mode: "fragment", instruction: "Paraphrase the sentences", prompt: "She is adapting to the new management style. -> She ________ the new management style.", accepted: ["is getting used to"] },
            { id: "ex3q5", mode: "fragment", instruction: "Paraphrase the sentences", prompt: "There was a cinema on this street, but it closed years ago. -> There ________ a cinema on this street.", accepted: ["used to be"] }
          ]
        }
      ]
    }
  };

  const STRUCTURES = [USED_TO];
  const byId = {};
  for (const s of STRUCTURES) byId[s.id] = s;

  window.StudentHelperStructures = { STRUCTURES, byId };
})();