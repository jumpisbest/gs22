// ===== ตั้งค่า PDF.js Worker =====
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PDF_PATH = 'GS22.pdf'; 
const TARGET_WIDTH = 794;
let activeRenderTasks = {};

// ===== โหลดและ Render PDF =====
async function loadPDF() {
  const pdfDoc = await pdfjsLib.getDocument(PDF_PATH).promise;
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    await renderPage(pdfDoc, pageNum);
  }
}

async function renderPage(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const baseScale = TARGET_WIDTH / viewport.width;

  const RENDER_SCALE = 3; 
  const scaledViewport = page.getViewport({ scale: baseScale * RENDER_SCALE });

  const canvas = document.getElementById(`pdf-canvas-${pageNum}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  canvas.style.width = `${TARGET_WIDTH}px`;
  canvas.style.height = 'auto';

  if (activeRenderTasks[pageNum]) {
    await activeRenderTasks[pageNum].cancel();
  }
  const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
  activeRenderTasks[pageNum] = renderTask;
  await renderTask.promise;
}

// ===== เมื่อเว็บโหลดเสร็จ =====
document.addEventListener('DOMContentLoaded', () => {
  loadPDF();

  // 🌟 ฟังก์ชันจัดการความกว้างของ Input ตามข้อความที่พิมพ์สำหรับ inline-field
  const autoResizeInput = (input) => {
    const span = document.createElement('span');
    const computedStyle = window.getComputedStyle(input);
    span.style.fontFamily = computedStyle.fontFamily || '"TH SarabunPSK", "TH Sarabun New"';
    span.style.fontSize = computedStyle.fontSize || '22px';
    span.style.fontWeight = computedStyle.fontWeight;
    span.style.fontStyle = computedStyle.fontStyle;
    span.style.letterSpacing = computedStyle.letterSpacing;
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'pre';
    span.style.position = 'absolute';
    span.textContent = input.value || input.getAttribute('placeholder') || ' ';
    document.body.appendChild(span);
    
    const newWidth = span.offsetWidth + 0;
    input.style.width = newWidth + 'px';
    document.body.removeChild(span);
  };

  document.querySelectorAll('.inline-field').forEach(input => {
    input.addEventListener('input', () => autoResizeInput(input));
    setTimeout(() => autoResizeInput(input), 100);
  });

  // 🌟 ระบบกล่องล่องหน: คำนวณพิกัดสัมพัทธ์หลังฟอนต์โหลดเสร็จ
  document.fonts.ready.then(() => {
    setTimeout(initGhostAnchors, 300);
  });

  const tabButtons = document.querySelectorAll('.tabs button');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page-wrapper').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`page${btn.dataset.page}`).classList.add('active');
    });
  });

  document.querySelectorAll('input[name="namePrefix"]').forEach(r => r.addEventListener('change', updateDynamicTexts));
  
  document.querySelectorAll('input[name="degreeLevel"]').forEach(r => {
      r.addEventListener('change', () => {
          updateDynamicTexts();
          updateProgramList();
      });
  });
  
  document.querySelectorAll('input[name="programType"]').forEach(r => r.addEventListener('change', updateDynamicTexts));
  document.getElementById('committeeCount').addEventListener('change', generateCommittee);

  document.getElementById('p1_program')?.addEventListener('change', handleProgramInput);
  document.getElementById('p2_program')?.addEventListener('change', handleProgramInput);

  updateProgramList();

  setupReqFlow('p1_thesis_value', ['p1_thesis1', 'p1_thesis2', 'p1_thesis3']);
  setupReqFlow('p2_thesis_value', ['p2_thesis1', 'p2_thesis2', 'p2_thesis3']);

  // 5. Export PDF
  document.getElementById('btn-export').addEventListener('click', async () => {
    const p1NameInput = document.getElementById('p1_name');
    const p2NameInput = document.getElementById('p2_name');

    document.body.classList.add('exporting');
    document.querySelectorAll('.page-wrapper').forEach(p => p.style.display = 'block');

    const EXPORT_SCALE = 3; 
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    try {
      const exportSelection = document.getElementById('exportPageSelect').value;
      let pagesToExport = [];
      if (exportSelection === 'both') {
          pagesToExport = [document.getElementById('page1'), document.getElementById('page2')];
      } else if (exportSelection === 'page1') {
          pagesToExport = [document.getElementById('page1')];
      } else if (exportSelection === 'page2') {
          pagesToExport = [document.getElementById('page2')];
      }

      for (let i = 0; i < pagesToExport.length; i++) {
        
        const canvas = await html2canvas(pagesToExport[i], { 
          scale: EXPORT_SCALE, 
          useCORS: true, 
          logging: false,
          onclone: function (clonedDoc) {
            function applyDiacriticFix(el) {
              el.style.setProperty('overflow', 'visible', 'important');
            }
            
            // 1. ฟังก์ชันจัดการความกว้างของ Input ตามข้อความที่พิมพ์
            const autoResizeInput = (input) => {
              // สร้าง span จำลองเพื่อวัดความกว้างของข้อความ
              const span = document.createElement('span');
              const computedStyle = window.getComputedStyle(input);
              span.style.fontFamily = computedStyle.fontFamily;
              span.style.fontSize = computedStyle.fontSize;
              span.style.fontWeight = computedStyle.fontWeight;
              span.style.fontStyle = computedStyle.fontStyle;
              span.style.letterSpacing = computedStyle.letterSpacing;
              
              span.style.visibility = 'hidden';
              span.style.whiteSpace = 'pre';
              span.style.position = 'absolute';
              // ใส่ข้อความ ถ้าว่างให้ใช้ placeholder หรือช่องว่าง
              span.textContent = input.value || input.getAttribute('placeholder') || ' ';
              document.body.appendChild(span);
              
              // ตั้งค่าความกว้างใหม่ โดยเผื่อพื้นที่ไว้เล็กน้อย (เช่น 10px)
              const newWidth = span.offsetWidth + 10;
              input.style.width = newWidth + 'px';
              document.body.removeChild(span);
            };

            // เปลี่ยน input แบบพิมพ์ให้กลายเป็น div ธรรมดาตอนทำ PDF
            const inputs = clonedDoc.querySelectorAll('input');
            inputs.forEach(input => {
              if (input.type === 'radio' || input.type === 'checkbox' || input.type === 'hidden') return;
              
              if (input.classList.contains('inline-field')) {
                // ใช้ span เปล่าไร้สไตล์ เพื่อให้ตัวอักษรกลมกลืนกับข้อความรอบข้าง 100% ไม่มีทางลอย
                const plainSpan = clonedDoc.createElement('span');
                plainSpan.innerText = input.value ? input.value : " ";
                input.parentNode.insertBefore(plainSpan, input);
                input.style.display = 'none';
                return;
              }

              const textSpan = clonedDoc.createElement('span');
              textSpan.innerText = input.value;
              textSpan.className = input.className;
              textSpan.id = input.id;           
              textSpan.style.cssText = input.style.cssText;
              input.removeAttribute('id');     
              
              textSpan.style.setProperty('overflow', 'visible', 'important');
              textSpan.style.setProperty('border', 'none', 'important');
              textSpan.style.setProperty('background', 'transparent', 'important');
              textSpan.style.setProperty('outline', 'none', 'important');
              textSpan.style.setProperty('white-space', 'nowrap', 'important');
              
              if (input.classList.contains('field')) {
                textSpan.style.position = 'absolute';
              } else {
                textSpan.style.display = 'inline-block';
                textSpan.style.verticalAlign = 'baseline';
              }
              
              input.parentNode.insertBefore(textSpan, input);
              input.style.display = 'none';
            });

            // ซ่อน Select ตัวจริงตอนปริ้น
            clonedDoc.querySelectorAll('select').forEach(sel => {
                sel.style.display = 'none';
            });
            
            clonedDoc.querySelectorAll('.fake-input, .fake-display').forEach(applyDiacriticFix);
            clonedDoc.querySelectorAll('.dynamic-text, .dynamic-text-inline').forEach(applyDiacriticFix);
          }
        });
        
        const imgData = canvas.toDataURL('image/png'); 
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      pdf.save('GS22_Form.pdf');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดตอน Export');
    } finally {
      document.body.classList.remove('exporting');
      document.querySelectorAll('.page-wrapper').forEach(p => p.style.display = '');
      document.querySelector(`.tabs button.active`).click();
    }
  });

});

function updateDynamicTexts() {
  const prefix = document.querySelector('input[name="namePrefix"]:checked').value;
  const program = document.querySelector('input[name="programType"]:checked').value;
  const degreeVal = document.querySelector('input[name="degreeLevel"]:checked').value;
  
  const degree = degreeVal === "master" ? "ปริญญาโท" : "ปริญญาเอก";
  const thesis = degreeVal === "master" ? "การค้นคว้าอิสระ" : "ดุษฎีนิพนธ์";

  document.querySelectorAll('.display-name-prefix').forEach(el => el.innerText = prefix);
  document.querySelectorAll('.display-program').forEach(el => el.innerText = program);
  document.querySelectorAll('.display-degree').forEach(el => el.innerText = degree);
  document.querySelectorAll('.thesis-word').forEach(el => el.innerText = thesis);
}

function generateCommittee() {
  const count = parseInt(document.getElementById('committeeCount').value);
  const containerP1 = document.getElementById('committee-area-p1');
  const containerP2 = document.getElementById('committee-area-p2');
  
  containerP1.innerHTML = '';
  containerP2.innerHTML = '';

  if (isNaN(count) || count === 0) return;

  for (let i = 0; i < count; i++) {
    const roleText = (i === 0) ? "ประธานกรรมการ" : "กรรมการ";
    
    const rowHTML_P1 = `
      <div class="committee-row">
          <input type="text" class="committee-input" placeholder="ชื่อ-นามสกุล" style="padding-top: 1px; transform: translateY(5px);">
          <div class="committee-role" style="transform: translateY(0px);">${roleText}</div>
      </div>
    `;
    
    const rowHTML_P2 = `
      <div class="committee-row">
          <input type="text" class="committee-input" placeholder="ชื่อ-นามสกุล" style="padding-top: 1px; transform: translateY(0px);">
          <div class="committee-role" style="transform: translateY(0px);">${roleText}</div>
      </div>
    `;
    
    containerP1.innerHTML += rowHTML_P1;
    containerP2.innerHTML += rowHTML_P2;
  }

  // ปรับระยะห่างของข้อความด้านล่างกรรมการให้อยู่ชิดติดกัน (เว้น 1 บรรทัดไม่ให้ทับเส้นประ)
  // แต่ละแถวสูง 24px และบวกเพิ่มอีก 24px สำหรับการเว้น 1 บรรทัด
  const baseTop = 507 + (count * 24) + 24;
  const postCommitteeStart = baseTop;

  document.querySelectorAll('.post-committee').forEach(el => {
      const offset = parseFloat(el.dataset.postOffset || 0);
      el.dataset.absTop = postCommitteeStart + offset;
  });

  // รีเซ็ตตำแหน่งใหม่ทั้งหมด
  initGhostAnchors();
}

function setupReqFlow(hiddenValId, fieldIds) {
  const hiddenInput = document.getElementById(hiddenValId);
  const fields = fieldIds.map(id => document.getElementById(id)).filter(f => f !== null);
  
  if (!hiddenInput || fields.length === 0) return;

  fields.forEach((field, index) => {
    field.addEventListener('input', () => {
      let fullText = fields.map(f => f.innerText).join('');
      hiddenInput.value = fullText;
      
      if (field.scrollWidth > field.clientWidth && index < fields.length - 1) {
        let text = field.innerText;
        field.innerText = text.slice(0, -1);
        fields[index + 1].innerText = text.slice(-1) + fields[index + 1].innerText;
        
        let range = document.createRange();
        let sel = window.getSelection();
        range.setStart(fields[index + 1].childNodes[0] || fields[index + 1], 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });
}

// ===== ระบบกล่องล่องหน (Ghost Anchor) - คำนวณพิกัดสัมพัทธ์ =====
// สร้าง div ล่องหนต่อท้ายข้อความหลัก แล้วคำนวณ top/left ให้ element ลูก
// อ้างอิงจากกล่องล่องหนแทนพิกัดกระดาษเดิม
function initGhostAnchors() {
  const ghosts = document.querySelectorAll('.ghost-anchor');
  if (ghosts.length === 0) return;

  // แสดงทุกหน้าชั่วคราวเพื่อวัดพิกัด (หน้าที่ซ่อนจะวัดไม่ได้)
  const pages = document.querySelectorAll('.page-wrapper');
  const savedDisplay = [];
  pages.forEach((p, i) => {
    savedDisplay[i] = { display: p.style.display, visibility: p.style.visibility };
    p.style.display = 'block';
    p.style.visibility = 'hidden';
  });

  // คืนค่าหน้าที่ active ให้มองเห็นได้
  document.querySelectorAll('.page-wrapper.active').forEach(p => {
    p.style.visibility = 'visible';
  });

  ghosts.forEach(ghost => {
    const pageWrapper = ghost.closest('.page-wrapper');
    if (!pageWrapper) return;

    const pageRect = pageWrapper.getBoundingClientRect();
    const ghostRect = ghost.getBoundingClientRect();

    // พิกัดของกล่องล่องหนเทียบกับ page-wrapper
    const ghostTop = ghostRect.top - pageRect.top;
    const ghostLeft = ghostRect.left - pageRect.left;

    // หาพิกัดเพื่อบังคับให้ "โดยมีคณะกรรมการที่ปรึกษา..." อยู่ห่าง 1 Enter (24px) เสมอ
    const word2 = ghost.querySelector('[id$="_thesis_word2"]');
    let shiftY = 0;
    if (word2 && word2.dataset.absTop) {
        const originalRelTop = parseFloat(word2.dataset.absTop) - ghostTop;
        shiftY = 0 - originalRelTop; // บังคับให้ relative top เป็น 0 (ต่อเลยไม่เว้นบรรทัด)
    }

    // ตั้งค่าพิกัด top/left ให้ลูกทุกตัว เป็นระยะสัมพัทธ์จากกล่องล่องหน + การขยับ (shiftY)
    ghost.querySelectorAll('[data-abs-top]').forEach(el => {
      const absTop = parseFloat(el.dataset.absTop);
      const absLeft = parseFloat(el.dataset.absLeft);

      el.style.top = (absTop - ghostTop + shiftY) + 'px';
      el.style.left = (absLeft - ghostLeft) + 'px';
    });
  });

  // คืนสถานะการแสดงผลเดิม
  pages.forEach((p, i) => {
    p.style.display = savedDisplay[i].display;
    p.style.visibility = savedDisplay[i].visibility;
  });
}

const academicData = {
    "master": {
        "การศึกษามหาบัณฑิต": ["การบริหารการศึกษา", "การวิจัยและประเมิน", "การสอนวิทยาศาสตร์และคณิตศาสตร์", "จิตวิทยา", "เทคโนโลยีและสื่อสารการศึกษา", "พลศึกษาและการจัดการกีฬา", "ภาษาไทย", "หลักสูตรและการสอน"],
        "ศิลปศาสตรมหาบัณฑิต": ["สื่อและวัฒนธรรมศึกษา"],
        "ดุริยางคศาสตรมหาบัณฑิต": ["ดนตรีสร้างสรรค์"],
        "นิติศาสตรมหาบัณฑิต": ["นิติศาสตร์"],
        "บริหารธุรกิจมหาบัณฑิต": ["การจัดการธุรกิจ"],
        "รัฐประศาสนศาสตรมหาบัณฑิต": ["รัฐประศาสนศาสตร์"],
        "วิทยาศาสตรมหาบัณฑิต": ["เคมีและนวัตกรรมเคมี", "เทคโนโลยีชีวภาพ", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาชีววิทยา)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาศาสตร์สิ่งแวดล้อม)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาฟิสิกส์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาคณิตศาสตร์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาการคำนวณ)", "อาชีวอนามัยและความปลอดภัย", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาพืชศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาประมง)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาสัตวศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาส่งเสริมเกษตรและพัฒนาชุมชน)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาวิทยาศาสตร์อาหาร)"],
        "สาธารณสุขศาสตรมหาบัณฑิต": ["สาธารณสุขศาสตร์(กลุ่มวิชาวิทยาการระบาดและชีวสถิติ)", "สาธารณสุขศาสตร์(กลุ่มวิชาการส่งเสริมสุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาเศรษฐศาสตร์สุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาบริหารสาธารณสุข)"],
        "วิศวกรรมศาสตรมหาบัณฑิต": ["วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมพลังงาน)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมเครื่องกล)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมไฟฟ้า)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมยาง)"]
    },
    "doctor": {
        "การศึกษาดุษฎีบัณฑิต": ["การบริหารการศึกษา", "หลักสูตรและการสอน(กลุ่มวิชาการศึกษาปฐมวัย)", "หลักสูตรและการสอน(กลุ่มวิชาการศึกษาประถมศึกษา)", "หลักสูตรและการสอน(กลุ่มวิชาการศึกษามัธยมศึกษา)", "หลักสูตรและการสอน(กลุ่มวิชาการอุดมศึกษาและอาชีวศึกษา)", "พลศึกษาและการจัดการกีฬา(กลุ่มวิชาพลศึกษา)", "พลศึกษาและการจัดการกีฬา(กลุ่มวิชาจัดการกีฬา)", "พลศึกษาและการจัดการกีฬา(กลุ่มวิชาบูรณาการด้านพลศึกษาและการจัดการกีฬา)"],
        "ปรัชญาดุษฎีบัณฑิต": ["เทคโนโลยีและสื่อสารการศึกษา", "สื่อและวัฒนธรรมศึกษา", "การจัดการธุรกิจ", "รัฐประศาสนศาสตร์", "การพัฒนาที่ยั่งยืน", "เทคโนโลยีชีวภาพ", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาชีววิทยา)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาศาสตร์สิ่งแวดล้อม)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาฟิสิกส์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาคณิตศาสตร์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาการคำนวณ)", "เคมีและนวัตกรรมเคมี", "วิทยาศาสตร์สุขภาพ", "อาชีวอนามัยและความปลอดภัย", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมพลังงาน)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมเครื่องกล)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมไฟฟ้า)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมยาง)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาพืชศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาประมง)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาสัตวศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาส่งเสริมเกษตรและพัฒนาชุมชน)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาวิทยาศาสตร์อาหาร)"],
        "นิติศาสตรดุษฎีบัณฑิต": ["นิติศาสตร์"],
        "สาธารณสุขศาสตรดุษฎีบัณฑิต": ["สาธารณสุขศาสตร์(กลุ่มวิชาวิทยาการระบาดและชีวสถิติ)", "สาธารณสุขศาสตร์(กลุ่มวิชาการส่งเสริมสุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาเศรษฐศาสตร์สุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาบริหารสาธารณสุข)"]
    }
};

function updateProgramList() {
    const degreeRadio = document.querySelector('input[name="degreeLevel"]:checked');
    if (!degreeRadio) return;
    const degreeVal = degreeRadio.value;
    
    const p1Program = document.getElementById('p1_program');
    const p2Program = document.getElementById('p2_program');
    const p1Major = document.getElementById('p1_major');
    const p2Major = document.getElementById('p2_major');

    if (!p1Program) return;

    p1Program.innerHTML = '<option value="">-- เลือกหลักสูตร --</option>';
    p2Program.innerHTML = '<option value="">-- เลือกหลักสูตร --</option>';
    p1Major.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';
    p2Major.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';

    // 🌟 เคลียร์ตัวอักษรกล่องโชว์จำลอง
    ['p1_program', 'p2_program', 'p1_major', 'p2_major'].forEach(id => {
        const disp = document.getElementById(id + '_display');
        if(disp) disp.innerText = '-- เลือก --';
    });

    if (academicData[degreeVal]) {
        const programs = Object.keys(academicData[degreeVal]);
        programs.forEach(p => {
            p1Program.add(new Option(p, p));
            p2Program.add(new Option(p, p));
        });
    }
}

function handleProgramInput(event) {
    const degreeVal = document.querySelector('input[name="degreeLevel"]:checked').value;
    const selectedProg = event.target.value;
    
    // 🌟 ส่งค่าหลักสูตรไปให้กล่องจำลองโชว์ผลบนจอ
    const disp = document.getElementById(event.target.id + '_display');
    if(disp) disp.innerText = selectedProg || '-- เลือก --';
    
    const isP1 = event.target.id === 'p1_program';
    const majorSelectId = isP1 ? 'p1_major' : 'p2_major';
    const majorSelect = document.getElementById(majorSelectId);
    
    if (!majorSelect) return;
    
    majorSelect.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';
    
    // เคลียร์ค่าสาขาในกล่องจำลอง
    const majorDisp = document.getElementById(majorSelectId + '_display');
    if(majorDisp) majorDisp.innerText = '-- เลือก --';
    
    if (degreeVal && selectedProg && academicData[degreeVal][selectedProg]) {
        const majors = academicData[degreeVal][selectedProg];
        majors.forEach(m => {
            majorSelect.add(new Option(m, m));
        });
    }

    // 🌟 ส่งค่าสาขาวิชาไปให้กล่องจำลองโชว์ผลบนจอเวลามีการเลือกใหม่
    majorSelect.onchange = function() {
        if(majorDisp) majorDisp.innerText = this.value || '-- เลือก --';
    };
}
