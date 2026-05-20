import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resume } from '@/app/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PDFParse } from 'pdf-parse';

export async function GET() {
  const resumes = await db
    .select({
      id: resume.id,
      name: resume.name,
      content: resume.content,
      createdAt: resume.createdAt,
    })
    .from(resume)
    .orderBy(desc(resume.createdAt));

  return NextResponse.json(resumes);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name;
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  let content: string;

  if (extension === 'pdf') {
    try {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      content = textResult.text;
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse PDF' },
        { status: 400 }
      );
    }
  } else if (extension === 'txt' || extension === 'md') {
    content = buffer.toString('utf-8');
  } else {
    return NextResponse.json(
      { error: 'Unsupported file type. Supported: .pdf, .txt, .md' },
      { status: 400 }
    );
  }

  const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
  const id = crypto.randomUUID();

  const newResume = await db.insert(resume).values({
    id,
    name: nameWithoutExtension,
    content,
  }).returning();

  return NextResponse.json(newResume[0], { status: 201 });
}
