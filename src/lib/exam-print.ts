import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Footer,
  PageNumber,
  TableBorders,
} from "docx";
import type { ExamDetail, AttemptView } from "@/lib/exams";

const NO_BORDERS = TableBorders.NONE;

const MAX_IMAGE_WIDTH = 360; // px, on-page width for embedded diagrams

async function loadImageAt(filePath: string, maxWidth: number) {
  const buffer = await fs.readFile(filePath);
  const dims = imageSize(buffer);
  const scale = Math.min(1, maxWidth / dims.width);
  return {
    data: buffer,
    width: Math.round(dims.width * scale),
    height: Math.round(dims.height * scale),
  };
}

async function loadImage(slug: string, filename: string) {
  return loadImageAt(
    path.join(process.cwd(), "public", "exam-media", slug, filename),
    MAX_IMAGE_WIDTH
  );
}

async function loadLogo() {
  return loadImageAt(
    path.join(process.cwd(), "public", "exam-media", "_branding", "sahpa-logo.png"),
    150
  );
}

function fieldLine(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } },
    spacing: { after: 200 },
  });
}

export async function buildExamDocx(
  studentName: string,
  exam: ExamDetail,
  attempt: AttemptView
) {
  // The PG and PPG exams' cover pages are byte-for-byte replicas of their
  // official SAHPA/SACAA master papers -- logo, the fraction marks table,
  // and verbatim instructional text -- and none of that belongs on any
  // other exam. Every other category (currently just the RT radio exam)
  // gets a plain, honest cover instead: no SAHPA branding, no invented
  // regulatory text, just the student's answers and score.
  const useSahpaMasterCover = exam.category === "pg" || exam.category === "ppg";

  const dateWritten = attempt.submittedAt
    ? attempt.submittedAt.toLocaleDateString()
    : "";
  const dateMarked = attempt.verifiedAt ? attempt.verifiedAt.toLocaleDateString() : "";
  const instructorName = attempt.verifiedByName ?? "";

  const logoPara = useSahpaMasterCover
    ? await loadLogo().then(
        (logo) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new ImageRun({
                type: "png",
                data: logo.data,
                transformation: { width: logo.width, height: logo.height },
              }),
            ],
          })
      )
    : null;

  const headerParas = [
    fieldLine("Student Name", studentName),
    fieldLine("Date Exam written", dateWritten),
    fieldLine("Instructor name", instructorName),
    fieldLine("Instructor Signature", ""),
    fieldLine("Date Marked", dateMarked),
  ];

  // Marks block: reproduces the master paper's own layout -- section
  // letters over a fraction of marks-obtained over marks-available, e.g.
  // "12 + 16.5 + ... = 61.5 = 31.5%" with the section totals (20 50 34 67
  // 9 15 195) as the denominators and "Pass Mark = 85%" alongside them.
  const sectionEarned = exam.sections.map((s) =>
    s.questions.reduce((sum, q) => {
      const sel = q.options.find((o) => o.id === q.selectedOptionId);
      return sum + (sel?.isCorrect ? q.marks : 0);
    }, 0)
  );
  const grandEarned = sectionEarned.reduce((a, b) => a + b, 0);
  const grandTotal = exam.totalMarks;
  const percent = grandTotal > 0 ? (grandEarned / grandTotal) * 100 : 0;

  function fmtMark(n: number) {
    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  }

  function marksCell(
    runs: TextRun[],
    opts: { bar?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}
  ) {
    return new TableCell({
      borders: opts.bar
        ? {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          }
        : undefined,
      children: [
        new Paragraph({
          alignment: opts.align ?? AlignmentType.CENTER,
          children: runs,
        }),
      ],
    });
  }
  const run = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    new TextRun({ text, ...opts });

  // Two-row fraction under a bottom-border "bar": marks earned per
  // section (+ grand total, + percent) on top, marks available below --
  // exactly the "----- / 20" layout of the master paper, just filled in.
  const letterRow = new TableRow({
    children: [
      ...exam.sections.map((s) => marksCell([run(s.code, { bold: true })])),
      marksCell([]),
      marksCell([]),
    ],
  });
  const numeratorRow = new TableRow({
    children: [
      ...sectionEarned.map((v) => marksCell([run(fmtMark(v))], { bar: true })),
      marksCell([run(`= ${fmtMark(grandEarned)}`, { bold: true })], { bar: true }),
      marksCell([run(`= ${percent.toFixed(1)} %`, { bold: true })], { bar: true }),
    ],
  });
  const denominatorRow = new TableRow({
    children: [
      ...exam.sections.map((s) => marksCell([run(fmtMark(s.totalMarks))])),
      marksCell(
        [
          run(fmtMark(grandTotal)),
          run(`   Pass Mark = ${exam.passPercent}%`, { italics: true, size: 18 }),
        ],
        { align: AlignmentType.LEFT }
      ),
      marksCell([]),
    ],
  });

  // The A-F fraction table is a direct copy of the SAHPA/SACAA master
  // paper's own layout and only makes sense when this exam actually has
  // that multi-section "airlaw etc." shape. Every other exam (the
  // single-section RT radio exam, and anything else added later) gets a
  // plain "score / total (percent)" line instead -- no invented table.
  const marksTable = useSahpaMasterCover
    ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        columnWidths: exam.sections.map(() => 800).concat([2300, 1000]),
        rows: [letterRow, numeratorRow, denominatorRow],
      })
    : new Paragraph({
        spacing: { after: 100 },
        children: [
          run(`${fmtMark(grandEarned)} / ${fmtMark(grandTotal)}`, { bold: true, size: 28 }),
          run(`   (${percent.toFixed(1)}%)   `, { bold: true, size: 28 }),
          run(`Pass mark: ${exam.passPercent}%`, { italics: true, size: 18 }),
        ],
      });

  // Result is folded in as a plain, small line rather than a big banner,
  // so the official SACAA layout above it is left untouched.
  const resultLine = new Paragraph({
    spacing: { before: 150, after: 300 },
    children: [
      new TextRun({ text: "Result: ", bold: true }),
      new TextRun({
        text: attempt.passed ? "PASS" : "FAIL",
        bold: true,
        color: attempt.passed ? "1a7a3a" : "c0392b",
      }),
      ...(useSahpaMasterCover && !attempt.mustPassSectionsOk
        ? [
            new TextRun({
              text: "  (not every Airlaw question was correct -- those must all be right to pass)",
              italics: true,
            }),
          ]
        : []),
    ],
  });

  const titleParas = [
    new Paragraph({
      spacing: { before: 100, after: 0 },
      children: [new TextRun({ text: exam.title.toUpperCase(), bold: true, size: 56 })],
    }),
  ];
  if (exam.subtitle) {
    titleParas.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: exam.subtitle, size: 20 })],
      })
    );
  }

  // Verbatim from each exam's own SACAA/SAHPA master paper -- do not
  // reword, this is the instruction block students and instructors
  // expect to see. Only PG and PPG have a master paper this text belongs
  // to; other exams get a short factual note instead of borrowed
  // regulatory language.
  const pgInstructionParas = [
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "You are encouraged to complete this paper as soon as convenient, during or after your course, whilst all information is still fresh in your mind.",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: "All 'airlaw' questions to be passed.", bold: true })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: "NOTE: This is an open book research examination. Please answer concisely. The test answers must be your own effort and should not be copied from others!",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: "Draw sketches where required (distinguish between describe and/or illustrate).",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Where sketches are provided, write/draw answers on them." }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "The test can be completed online and then printed to finish the drawings/illustrations and hard copy to be submitted to your instructor.",
        }),
      ],
    }),
  ];

  const ppgInstructionParas = [
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "You are encouraged to complete this paper as soon as convenient, after or during your course, whilst all information is still fresh in your mind.",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: "Air law questions to be passed, 100%", bold: true })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: "NOTE: This is an open book research examination. Please answer concisely. The test answers must be your own effort, and should not be copied from others!",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: "Draw sketches where required (distinguish between describe and/or illustrate).",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Where sketches are provided, write answers on them." }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "All Answers must be typed out, NO handwritten Answers and must be in English.",
        }),
      ],
    }),
  ];

  const genericInstructionParas = [
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "Printed record of a completed online exam, for the training file.",
          italics: true,
        }),
      ],
    }),
  ];

  const instructionParas =
    exam.category === "pg"
      ? pgInstructionParas
      : exam.category === "ppg"
        ? ppgInstructionParas
        : genericInstructionParas;

  const body: (Paragraph | Table)[] = [
    ...(logoPara ? [logoPara] : []),
    ...headerParas,
    hr(),
    new Paragraph({
      children: [new TextRun({ text: "MARKS", bold: true, underline: {} })],
      spacing: { after: 100 },
    }),
    marksTable,
    resultLine,
    ...titleParas,
    ...instructionParas,
  ];

  for (const [sectionIdx, section] of exam.sections.entries()) {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: sectionIdx === 0,
        spacing: { before: 300, after: 150 },
        children: [
          new TextRun({ text: `SECTION ${section.code}: ${section.name}`, bold: true }),
        ],
      })
    );

    for (const q of section.questions) {
      // Print never reveals which option would have been correct -- only
      // the student's own answer, ticked or crossed. It also never shows
      // the other options, so the paper reads as an open-answer exam
      // rather than a multiple-choice one.
      const selected = q.options.find((o) => o.id === q.selectedOptionId);
      const isCorrect = !!selected?.isCorrect;
      const humanNumber = q.code.replace(/^[A-F]\./, "");
      const promptText = q.printPrompt ?? q.prompt;

      body.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({ text: `${humanNumber}. `, bold: true }),
            new TextRun({ text: promptText }),
            new TextRun({ text: `  (${q.marks} mk)`, italics: true }),
          ],
        })
      );

      if (q.stemImage) {
        const img = await loadImage(exam.slug, q.stemImage);
        body.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: "jpg",
                data: img.data,
                transformation: { width: img.width, height: img.height },
              }),
            ],
          })
        );
      }

      const answerRuns: (Paragraph | Table)[] = [];
      if (selected?.image) {
        const img = await loadImage(exam.slug, selected.image);
        answerRuns.push(
          new Paragraph({
            spacing: { before: 60 },
            children: [
              new TextRun({ text: "Answer:  " }),
              new TextRun({
                text: isCorrect ? "✔" : "✘",
                bold: true,
                color: isCorrect ? "1a7a3a" : "c0392b",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new ImageRun({
                type: "jpg",
                data: img.data,
                transformation: { width: img.width, height: img.height },
              }),
            ],
          })
        );
      } else {
        answerRuns.push(
          new Paragraph({
            spacing: { before: 60 },
            children: [
              new TextRun({ text: "Answer: ", bold: true }),
              new TextRun({ text: selected ? `${selected.text}` : "(no answer)" }),
              new TextRun({ text: "  " }),
              new TextRun({
                text: isCorrect ? "✔" : "✘",
                bold: true,
                color: isCorrect ? "1a7a3a" : "c0392b",
              }),
            ],
          })
        );
      }
      body.push(...answerRuns);
    }

    const sIdx = exam.sections.indexOf(section);
    body.push(
      new Paragraph({
        spacing: { before: 150, after: 100 },
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `Section Total: ${sectionEarned[sIdx]} / ${section.totalMarks}`,
            bold: true,
          }),
        ],
      }),
      hr()
    );
  }

  body.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: `Grand Total: ${grandEarned} / ${grandTotal}  (${percent.toFixed(1)}%)`,
          bold: true,
          size: 26,
        }),
      ],
    })
  );

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 8, color: "8B0000" } },
        spacing: { before: 100 },
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ children: ["Page ", PageNumber.CURRENT], size: 18 }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: { default: pageFooter },
        children: body,
      },
    ],
  });

  return doc;
}
