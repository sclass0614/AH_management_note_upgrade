// Supabase 클라이언트는 supabase.js에서 이미 초기화됨
// supabaseClient 변수를 사용하여 Supabase에 접근

// Supabase 클라이언트 가져오기 함수
function getSupabaseClient() {
    // 먼저 window.supabaseClient 확인
    if (window.supabaseClient) {
        return window.supabaseClient;
    }
    // 그 다음 window.supabase 확인
    if (window.supabase) {
        return window.supabase;
    }
    // 마지막으로 전역 supabase 객체 확인
    if (typeof supabase !== 'undefined') {
        return supabase;
    }
    console.error('Supabase 클라이언트를 찾을 수 없습니다.');
    return null;
}

// 전역 변수
let currentDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 오늘 날짜 (YYYYMMDD 형식)
let managementNoteData = []; // management_note_total 데이터
let individualWorkData = []; // management_note_individual 데이터
let employeesInfoData = []; // employeesinfo 데이터
let originalData = null; // 카테고리 선택 시 원본 데이터 저장 (동시 편집 충돌 방지용)
let attendanceData = []; // activities_journal 데이터 (이용인원)
let membersInfoData = []; // membersinfo 데이터 (전체 회원 정보)

// DOM 요소들
const datePicker = document.getElementById('datePicker');
const updateReportBtn = document.getElementById('updateReportBtn');
const employeeNumberInput = document.getElementById('employeeNumber');
const employeeNameInput = document.getElementById('employeeName');
const originalEmployeeNumberInput = document.getElementById('originalEmployeeNumber');
const originalEmployeeNameInput = document.getElementById('originalEmployeeName');
const categorySelect = document.getElementById('categorySelect');
const contentTextarea = document.getElementById('contentTextarea');
const submitBtn = document.getElementById('submitBtn');
const printBtn = document.getElementById('printBtn');

// 보고서 요소들
const reportDate = document.getElementById('reportDate');
const handoverContent = document.getElementById('handoverContent');
const elderlyContent = document.getElementById('elderlyContent');
const basicRulesContent = document.getElementById('basicRulesContent');
const otherMattersContent = document.getElementById('otherMattersContent');
const individualWorkTableBody = document.getElementById('individualWorkTableBody');

// 회원 운영현황 요소들
const capacityCountCell = document.getElementById('capacityCountCell');
const capacityDetailCell = document.getElementById('capacityDetailCell');
const currentMemberCountCell = document.getElementById('currentMemberCountCell');
const currentMemberDetailCell = document.getElementById('currentMemberDetailCell');
const attendanceCountCell = document.getElementById('attendanceCountCell');
const attendanceDetailCell = document.getElementById('attendanceDetailCell');
const absentCountCell = document.getElementById('absentCountCell');
const absentListCell = document.getElementById('absentListCell');
const restDayCountCell = document.getElementById('restDayCountCell');
const restDayListCell = document.getElementById('restDayListCell');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== 페이지 로드 시작 ===');
    console.log('현재 URL:', window.location.href);
    console.log('페이지 제목:', document.title);
    
    // 1단계: 페이지 초기화
    initializePage();
    
    // 2단계: PostMessage 리스너 설정
    setupPostMessageListener();
    
    // 3단계: 페이지 초기화 완료 후 직원번호 로드 (비동기로 처리)
    setTimeout(() => {
        console.log('=== 직원번호 로드 시작 (초기화 완료 후) ===');
        loadEmployeeNumberFromURL();
    }, 100);
    
    // 4단계: A4용지 크기 조정 설정
    setupA4PaperResize();
    
    console.log('=== 페이지 로드 완료 ===');
});

// 페이지 초기화
function initializePage() {
    console.log('=== 페이지 초기화 시작 ===');
    
    // Supabase 클라이언트 초기화 확인
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
        console.error('Supabase 클라이언트가 초기화되지 않았습니다. 잠시 후 다시 시도합니다.');
        setTimeout(initializePage, 500);
        return;
    }
    
    console.log('Supabase 클라이언트 초기화 확인됨');
    
    // 직원번호 입력 필드 초기화
    employeeNumberInput.value = '';
    employeeNameInput.value = '';
    originalEmployeeNumberInput.value = '';
    originalEmployeeNameInput.value = '';
    console.log('직원번호 입력 필드 초기화 완료');
    
    // 오늘 날짜로 date picker 설정 (YYYY-MM-DD 형식)
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    
    // 보고서 날짜 표시
    updateReportDate();
    
    // 이벤트 리스너 등록
    setupEventListeners();
    
    // 초기 데이터 로드
    loadReportData();
    
    console.log('=== 페이지 초기화 완료 ===');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 날짜 변경 시
    datePicker.addEventListener('change', function() {
        // YYYY-MM-DD 형식을 YYYYMMDD 형식으로 변환
        currentDate = this.value.replace(/-/g, '');
        updateReportDate();
        // 날짜가 변경되면 데이터를 새로 가져오기
        loadReportData();
    });
    
    // 보고서 업데이트 버튼
    updateReportBtn.addEventListener('click', loadReportData);
    
    // 인쇄 버튼
    printBtn.addEventListener('click', printReport);
    
    // 입력 버튼
    submitBtn.addEventListener('click', submitData);
    
    // 휴무자 편집 가능 셀 이벤트
    setupEditableCells();
    
    // 카테고리 변경 시
    categorySelect.addEventListener('change', function() {
        if (this.value) {
            // 직원번호와 직원명은 그대로 유지 (변경하지 않음)
            // 해당 카테고리의 모든 내용을 textarea에 로드
            loadCategoryContent(this.value);
        } else {
            // 카테고리가 선택되지 않으면 내용만 비움 (직원 정보는 유지)
            contentTextarea.value = '';
            // 기존 작성자 정보도 초기화
            originalEmployeeNumberInput.value = '';
            originalEmployeeNameInput.value = '';
            // 직원번호와 직원명은 유지 (초기화하지 않음)
        }
    });
    
    // contentTextarea 포커스 시 카테고리 선택 확인
    contentTextarea.addEventListener('focus', function() {
        if (!categorySelect.value) {
            customAlert('카테고리를 먼저 선택해주세요.', '카테고리 선택');
            // 포커스를 카테고리 선택으로 이동
            categorySelect.focus();
        }
    });
    
    // contentTextarea 입력 시 높이 자동 조정
    contentTextarea.addEventListener('input', function() {
        adjustTextareaHeight();
    });
    
    // text-area 더블클릭 이벤트 설정
    setupTextareaDoubleClickEvents();
}

// 보고서 날짜 업데이트
function updateReportDate() {
    // YYYYMMDD 형식을 Date 객체로 변환
    const year = currentDate.substring(0, 4);
    const month = currentDate.substring(4, 6);
    const day = currentDate.substring(6, 8);
    const date = new Date(year, month - 1, day);
    
    // yyyy.mm.dd(요일) 형식으로 포맷팅
    const yearStr = year;
    const monthStr = month.padStart(2, '0');
    const dayStr = day.padStart(2, '0');
    
    // 요일을 한글 약자로 변환
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    
    const formattedDate = `${yearStr}.${monthStr}.${dayStr}(${weekday})`;
    reportDate.textContent = formattedDate;
}

// Supabase에서 데이터 로드
async function loadReportData() {
    try {
        const supabaseClient = getSupabaseClient();
        // Supabase 클라이언트 확인
        if (!supabaseClient) {
            console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
            return;
        }
        
        console.log('데이터 로딩 시작...');
        console.log('현재 날짜 (YYYYMMDD):', currentDate);
        
        // management_note_total 데이터 로드
        const { data: totalData, error: totalError } = await supabaseClient
            .from('management_note_total')
            .select('*')
            .eq('날짜', currentDate);
        
        if (totalError) {
            console.error('management_note_total 로드 에러:', totalError);
            return;
        }
        
        managementNoteData = totalData || [];
        console.log('management_note_total 데이터:', managementNoteData);
        
        // management_note_individual 데이터 로드
        const { data: individualData, error: individualError } = await supabaseClient
            .from('management_note_individual')
            .select('*')
            .eq('날짜', currentDate);
        
        if (individualError) {
            console.error('management_note_individual 로드 에러:', individualError);
            return;
        }
        
        individualWorkData = individualData || [];
        console.log('management_note_individual 데이터:', individualWorkData);
        
        // employeesinfo 데이터 로드
        const { data: employeesData, error: employeesError } = await supabaseClient
            .from('employeesinfo')
            .select('직원번호, 담당직종');
        
        if (employeesError) {
            console.error('employeesinfo 로드 에러:', employeesError);
            return;
        }
        
        employeesInfoData = employeesData || [];
        console.log('employeesinfo 데이터:', employeesInfoData);
        
        // activities_journal 데이터 로드 (이용인원)
        const { data: attendanceDataResult, error: attendanceError } = await supabaseClient
            .from('activities_journal')
            .select('회원번호, 회원명')
            .eq('날짜', currentDate);
        
        if (attendanceError) {
            console.error('activities_journal 로드 에러:', attendanceError);
            return;
        }
        
        attendanceData = attendanceDataResult || [];
        console.log('activities_journal 데이터:', attendanceData);
        
        // membersinfo 데이터 로드 (전체 회원 정보)
        console.log('=== membersinfo 데이터 로드 시작 ===');
        console.log('조회할 날짜:', currentDate);
        
        const { data: membersData, error: membersError } = await supabaseClient
            .from('membersinfo')
            .select('회원번호, 회원명, 입소일, 퇴소일');
        
        console.log('membersinfo 쿼리 결과:');
        console.log('- data:', membersData);
        console.log('- error:', membersError);
        
        if (membersError) {
            console.error('membersinfo 로드 에러:', membersError);
            return;
        }
        
        membersInfoData = membersData || [];
        console.log('membersinfo 데이터:', membersInfoData);
        console.log('전체 회원 수:', membersInfoData.length);
        
        if (membersInfoData.length > 0) {
            console.log('첫 번째 회원 데이터:', membersInfoData[0]);
            console.log('회원 데이터 컬럼명:', Object.keys(membersInfoData[0]));
        }
        
        console.log('=== membersinfo 데이터 로드 완료 ===');
        
        // UI 업데이트
        updateReportUI();
        
    } catch (error) {
        console.error('데이터 로드 중 예외 발생:', error);
    }
}

// 보고서 UI 업데이트
function updateReportUI() {
    // 회원 운영현황 업데이트
    updateMemberStatus();
    
    // 전달사항 업데이트 (div 요소)
    const handoverData = managementNoteData.filter(item => item.카테고리 === '전달사항');
    handoverContent.textContent = handoverData.map(item => item.내용).join('\n\n');
    
    // 어르신 특이사항 업데이트 (div 요소)
    const elderlyData = managementNoteData.filter(item => item.카테고리 === '어르신 특이사항');
    elderlyContent.textContent = elderlyData.map(item => item.내용).join('\n\n');
    
    // 기본규칙 업데이트 (div 요소)
    const basicRulesData = managementNoteData.filter(item => item.카테고리 === '기본규칙');
    basicRulesContent.textContent = basicRulesData.map(item => item.내용).join('\n\n');
    
    // 기타사항 업데이트 (div 요소)
    const otherMattersData = managementNoteData.filter(item => item.카테고리 === '기타사항');
    otherMattersContent.textContent = otherMattersData.map(item => item.내용).join('\n\n');
    
    // 개인업무일지 테이블 업데이트
    updateIndividualWorkTable();
}

// 회원 운영현황 업데이트
function updateMemberStatus() {
    console.log('=== 회원 운영현황 업데이트 시작 ===');
    console.log('현재 날짜:', currentDate);
    console.log('전체 회원 데이터:', membersInfoData);
    
    // 현재 날짜 기준으로 입소 중인 회원 필터링
    const currentMembers = membersInfoData.filter(member => {
        const 입소일 = member.입소일 || '';
        const 퇴소일 = member.퇴소일 || '';
        
        console.log(`회원 ${member.회원명} (${member.회원번호}):`);
        console.log(`- 입소일: "${입소일}"`);
        console.log(`- 퇴소일: "${퇴소일}"`);
        console.log(`- 현재날짜: "${currentDate}"`);
        
        // 입소일이 현재 날짜보다 이전이고, 퇴소일이 없거나 현재 날짜보다 이후인 경우
        const isAdmitted = 입소일 <= currentDate && (퇴소일 === '' || 퇴소일 > currentDate);
        console.log(`- 입소중 여부: ${isAdmitted}`);
        
        return isAdmitted;
    });
    
    console.log('입소중인 회원들:', currentMembers);
    
    // 현원 계산 (입소 중인 회원 수)
    const currentMemberCountValue = currentMembers.length;
    currentMemberCountCell.textContent = `${currentMemberCountValue}명`;
    console.log('현원:', currentMemberCountValue);
    
    // 이용인원 계산 (중복 제거된 회원번호 개수)
    const uniqueAttendanceMembers = [...new Set(attendanceData.map(item => item.회원번호))];
    const attendanceCountValue = uniqueAttendanceMembers.length;
    attendanceCountCell.textContent = `${attendanceCountValue}명`;
    console.log('이용인원:', attendanceCountValue);
    console.log('이용인원 회원번호들:', uniqueAttendanceMembers);
    
    // 결석자 계산 (입소 중인 회원 중 이용하지 않은 회원)
    const attendanceMemberNumbers = new Set(uniqueAttendanceMembers);
    const absentMembers = currentMembers.filter(member => 
        !attendanceMemberNumbers.has(member.회원번호)
    );
    
    const absentCountValue = absentMembers.length;
    absentCountCell.textContent = `${absentCountValue}명`;
    console.log('결석자:', absentCountValue);
    console.log('결석자 목록:', absentMembers);
    
    // 결석자 명단 표시 (자동 계산된 결과를 초기값으로 설정)
    if (absentMembers.length > 0) {
        const absentNames = absentMembers.map(member => member.회원명).join('어르신, ') + '어르신';
        absentListCell.textContent = absentNames;
        console.log('결석자 명단:', absentNames);
    } else {
        absentListCell.textContent = '';
        console.log('결석자 없음');
    }
    
    console.log('=== 회원 운영현황 업데이트 완료 ===');
    
    // 휴무자 수는 더 이상 자동 업데이트하지 않음 (사용자가 직접 편집)
}

// 편집 가능 셀 설정
function setupEditableCells() {
    // 정원 수 셀
    capacityCountCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'count');
    });
    
    // 정원 상세 셀
    capacityDetailCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'list');
    });
    
    // 현원 수 셀
    currentMemberCountCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'count');
    });
    
    // 현원 상세 셀
    currentMemberDetailCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'list');
    });
    
    // 이용인원 수 셀
    attendanceCountCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'count');
    });
    
    // 이용인원 상세 셀
    attendanceDetailCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'list');
    });
    
    // 결석자 수 셀
    absentCountCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'count');
    });
    
    // 결석자 명단 셀
    absentListCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'list');
    });
    
    // 휴무자 수 셀
    restDayCountCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'count');
    });
    
    // 휴무자 명단 셀
    restDayListCell.addEventListener('dblclick', function() {
        makeCellEditable(this, 'list');
    });
}

// 셀을 편집 가능하게 만들기
function makeCellEditable(cell, type) {
    if (cell.classList.contains('editing')) return;
    
    const originalText = cell.textContent.replace('명', '').trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = type === 'count' ? originalText : originalText;
    input.className = 'cell-input';
    
    cell.classList.add('editing');
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    // Enter 키로 저장
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveCellEdit(cell, type, input.value);
        } else if (e.key === 'Escape') {
            cancelCellEdit(cell, type, originalText);
        }
    });
    
    // 포커스 아웃 시 저장
    input.addEventListener('blur', function() {
        saveCellEdit(cell, type, input.value);
    });
}

// 셀 편집 저장
function saveCellEdit(cell, type, value) {
    cell.classList.remove('editing');
    
    if (type === 'count') {
        const count = value.trim() ? parseInt(value) : 0;
        cell.textContent = `${count}명`;
    } else if (type === 'list') {
        cell.textContent = value.trim();
    }
}

// 셀 편집 취소
function cancelCellEdit(cell, type, originalText) {
    cell.classList.remove('editing');
    
    if (type === 'count') {
        cell.textContent = `${originalText}명`;
    } else if (type === 'list') {
        cell.textContent = originalText;
    }
}

// 개인업무일지 테이블 업데이트
function updateIndividualWorkTable() {
    // 테이블 내용 초기화
    individualWorkTableBody.innerHTML = '';
    
    if (individualWorkData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4" style="text-align: center; color: #666;">등록된 개인업무가 없습니다.</td>';
        individualWorkTableBody.appendChild(emptyRow);
        return;
    }
    
    // 담당직종 우선순위 정의
    const 직종우선순위 = {
        '시설장': 1,
        '사무국장': 2,
        '사회복지사': 3,
        '작업치료사': 4,
        '요양보호사': 5,
        '사무원': 6,
        '조리원': 7,
        '운전원': 8
    };
    
    // 데이터에 담당직종 정보 추가 및 정렬
    const processedData = individualWorkData.map(item => {
        // 직원번호로 담당직종 찾기 (대소문자 구분 없이)
        const employeeInfo = employeesInfoData.find(emp => 
            emp.직원번호 && item.직원번호 && 
            emp.직원번호.toLowerCase() === item.직원번호.toLowerCase()
        );
        const 담당직종 = employeeInfo ? employeeInfo.담당직종 : '';
        
        return {
            ...item,
            담당직종: 담당직종,
            직종우선순위: 직종우선순위[담당직종] || 999 // 정의되지 않은 직종은 마지막에
        };
    });
    
    // 정렬: 담당직종 → 직원번호 → 직원명
    processedData.sort((a, b) => {
        // 1. 담당직종 우선순위로 정렬
        if (a.직종우선순위 !== b.직종우선순위) {
            return a.직종우선순위 - b.직종우선순위;
        }
        
        // 2. 직원번호로 정렬
        if (a.직원번호 !== b.직원번호) {
            return (a.직원번호 || '').localeCompare(b.직원번호 || '');
        }
        
        // 3. 직원명으로 정렬
        return (a.직원명 || '').localeCompare(b.직원명 || '');
    });
    
    // 그룹별로 데이터 정리
    const groupedData = {};
    processedData.forEach(item => {
        const groupKey = `${item.담당직종}|${item.직원번호}|${item.직원명}`;
        if (!groupedData[groupKey]) {
            groupedData[groupKey] = {
                담당직종: item.담당직종,
                직원번호: item.직원번호,
                직원명: item.직원명,
                업무내용들: []
            };
        }
        groupedData[groupKey].업무내용들.push(item.업무내용);
    });
    
    // 그룹별로 테이블 행 생성 (rowspan 포함)
    Object.values(groupedData).forEach(group => {
        const workCount = group.업무내용들.length;
        
        // 첫 번째 행 생성 (모든 정보 포함)
        const firstRow = document.createElement('tr');
        firstRow.innerHTML = `
            <td rowspan="${workCount}">${group.담당직종 || ''}</td>
            <td rowspan="${workCount}">${group.직원번호 || ''}</td>
            <td rowspan="${workCount}">${group.직원명 || ''}</td>
            <td style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">${group.업무내용들[0] || ''}</td>
        `;
        individualWorkTableBody.appendChild(firstRow);
        
        // 추가 업무내용이 있으면 별도 행으로 추가 (앞 3개 셀은 rowspan으로 처리됨)
        for (let i = 1; i < group.업무내용들.length; i++) {
            const additionalRow = document.createElement('tr');
            additionalRow.innerHTML = `
                <td style="white-space: pre-wrap; word-wrap: break-word; word-break: break-word;">${group.업무내용들[i]}</td>
            `;
            individualWorkTableBody.appendChild(additionalRow);
        }
    });
}

// 카테고리별 내용 로드 (편집용)
function loadCategoryContent(category) {
    // 해당 카테고리의 첫 번째 데이터만 가져오기 (하나의 카테고리당 하나의 데이터만 존재)
    const categoryData = managementNoteData.filter(item => item.카테고리 === category);
    if (categoryData.length > 0) {
        const firstData = categoryData[0];
        contentTextarea.value = firstData.내용 || '';
        
        // 기존 작성자 정보 표시
        originalEmployeeNumberInput.value = firstData.직원번호 || '';
        originalEmployeeNameInput.value = firstData.직원명 || '';
        
        // 원본 데이터 저장 (동시 편집 충돌 방지용) - 날짜와 카테고리 기준으로 변경
        originalData = {
            날짜: currentDate,
            카테고리: category,
            직원번호: firstData.직원번호 || '',
            직원명: firstData.직원명 || '',
            내용: firstData.내용 || ''
        };
    } else {
        contentTextarea.value = '';
        // 기존 작성자 정보 초기화
        originalEmployeeNumberInput.value = '';
        originalEmployeeNameInput.value = '';
        originalData = null;
    }
    
    // textarea 높이 자동 조정
    adjustTextareaHeight();
}

// 데이터 입력 처리
async function submitData() {
    const supabaseClient = getSupabaseClient();
    // Supabase 클라이언트 확인
    if (!supabaseClient) {
        console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
        await customAlert('데이터베이스 연결에 문제가 있습니다.', '오류');
        return;
    }
    
    // 입력값 검증
    const employeeNumber = employeeNumberInput.value.trim();
    const employeeName = employeeNameInput.value.trim();
    const category = categorySelect.value;
    const content = contentTextarea.value.trim();
    
    // 직원번호 입력 확인
    if (!employeeNumber) {
        await customAlert('직원번호를 입력해주세요.', '직원번호 입력');
        employeeNumberInput.focus();
        return;
    }
    
    // 카테고리 선택 확인
    if (!category) {
        await customAlert('카테고리를 먼저 선택해주세요.', '카테고리 선택');
        categorySelect.focus();
        return;
    }
    
    // 내용 입력 확인
    if (!content) {
        await customAlert('내용을 입력해주세요.', '내용 입력');
        contentTextarea.focus();
        return;
    }
    
    try {
        let result;
        
        // 날짜와 카테고리로 기존 데이터 확인
        console.log('날짜와 카테고리로 기존 데이터 확인:', currentDate, category);
            
        const { data: existingData, error: fetchError } = await supabaseClient
                .from('management_note_total')
                .select('*')
            .eq('날짜', currentDate)
            .eq('카테고리', category)
                .single();
            
        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('기존 데이터 조회 에러:', fetchError);
            await customAlert('데이터 조회 중 오류가 발생했습니다.', '오류');
                return;
            }
            
        if (existingData) {
            // 기존 데이터가 있으면 업데이트
            console.log('기존 데이터 업데이트:', existingData.id);
            
            // 원본 데이터와 서버 데이터 비교 (충돌 방지)
            if (originalData && existingData.내용 !== originalData.내용) {
                // 다른 사용자가 수정한 경우 모달 표시
                showConflictModal(existingData);
                return;
            }
            
            // 충돌이 없으면 업데이트 진행
            const { data, error } = await supabaseClient
                .from('management_note_total')
                .update({
                    직원번호: employeeNumber,
                    직원명: employeeName,
                    내용: content
                })
                .eq('날짜', currentDate)
                .eq('카테고리', category);
            
            if (error) {
                console.error('데이터 업데이트 에러:', error);
                await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
                return;
            }
            
            result = data;
            console.log('데이터 업데이트 성공:', result);
        } else {
            // 새 데이터 삽입
            console.log('새 데이터 삽입');
            const { data, error } = await supabaseClient
                .from('management_note_total')
                .insert([
                    {
                        직원번호: employeeNumber,
                        직원명: employeeName,
                        날짜: currentDate, // YYYYMMDD 형식
                        카테고리: category,
                        내용: content
                    }
                ]);
            
            if (error) {
                console.error('데이터 입력 에러:', error);
                await customAlert('데이터 입력 중 오류가 발생했습니다.', '오류');
                return;
            }
            
            result = data;
            console.log('데이터 입력 성공:', result);
        }
        
        // 입력 폼 초기화
        clearForm();
        
        // 보고서 데이터 다시 로드
        await loadReportData();
        
        await customAlert(
            existingData ? '데이터가 성공적으로 업데이트되었습니다.' : '데이터가 성공적으로 입력되었습니다.',
            '완료'
        );
        
    } catch (error) {
        console.error('데이터 처리 중 예외 발생:', error);
        await customAlert('데이터 처리 중 오류가 발생했습니다.', '오류');
    }
}

// textarea 높이 자동 조정 함수
function adjustTextareaHeight() {
    const textarea = contentTextarea;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// 보고서 textarea 높이 자동 조정 함수 (div로 변경되어 불필요)
// function adjustReportTextareaHeight(textarea) {
//     textarea.style.height = 'auto';
//     textarea.style.height = textarea.scrollHeight + 'px';
// }

// 충돌 모달 표시 함수
function showConflictModal(serverData) {
    const modalHtml = `
        <div id="conflictModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚠️ 동시 편집 충돌 감지</h3>
                </div>
                <div class="modal-body">
                    <p>다른 사용자가 동시에 이 내용을 수정했습니다.</p>
                    <div class="conflict-info">
                        <h4>서버의 최신 데이터:</h4>
                        <div class="info-item">
                            <strong>직원번호:</strong> ${serverData.직원번호 || '없음'}
                        </div>
                        <div class="info-item">
                            <strong>직원명:</strong> ${serverData.직원명 || '없음'}
                        </div>
                                                 <div class="info-item">
                             <strong>내용:</strong>
                             <div class="content-preview">${serverData.내용 ? serverData.내용.replace(/\n/g, '\n') : '없음'}</div>
                         </div>
                    </div>
                    <p class="warning-text">계속 진행하시겠습니까? 현재 입력한 내용으로 덮어쓰게 됩니다.</p>
                </div>
                <div class="modal-footer">
                    <button id="continueBtn" class="btn-primary">계속 진행</button>
                    <button id="cancelBtn" class="btn-secondary">취소</button>
                </div>
            </div>
        </div>
    `;
    
    // 모달을 body에 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 모달 이벤트 리스너
    document.getElementById('continueBtn').addEventListener('click', async function() {
        // 사용자가 계속 진행을 선택한 경우 강제 업데이트
        await forceUpdate();
        closeConflictModal();
    });
    
    document.getElementById('cancelBtn').addEventListener('click', function() {
        closeConflictModal();
    });
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('conflictModal').addEventListener('click', function(e) {
        if (e.target.id === 'conflictModal') {
            closeConflictModal();
        }
    });
}

// 강제 업데이트 함수
async function forceUpdate() {
    const supabaseClient = getSupabaseClient();
    const employeeNumber = employeeNumberInput.value.trim();
    const employeeName = employeeNameInput.value.trim();
    const content = contentTextarea.value.trim();
    const category = categorySelect.value;
    
    try {
        const { data, error } = await supabaseClient
            .from('management_note_total')
            .update({
                직원번호: employeeNumber,
                직원명: employeeName,
                내용: content
            })
            .eq('날짜', currentDate)
            .eq('카테고리', category);
        
        if (error) {
            console.error('강제 업데이트 에러:', error);
            await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
            return;
        }
        
        console.log('강제 업데이트 성공:', data);
        
        // 입력 폼 초기화
        clearForm();
        
        // 보고서 데이터 다시 로드
        await loadReportData();
        
        await customAlert('데이터가 성공적으로 업데이트되었습니다.', '완료');
        
    } catch (error) {
        console.error('강제 업데이트 중 예외 발생:', error);
        await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
    }
}

// 충돌 모달 닫기 함수
function closeConflictModal() {
    const modal = document.getElementById('conflictModal');
    if (modal) {
        modal.remove();
    }
}

// 입력 폼 초기화
function clearForm() {
    // 직원번호와 직원명은 유지 (초기화하지 않음)
    // employeeNumberInput.value = '';
    // employeeNameInput.value = '';
    
    // 기존 작성자 정보도 유지 (초기화하지 않음)
    // originalEmployeeNumberInput.value = '';
    // originalEmployeeNameInput.value = '';
    
    // 카테고리와 내용만 초기화
    categorySelect.value = '';
    contentTextarea.value = '';
    
    // 원본 데이터 초기화
    originalData = null;
    
    // textarea 높이 초기화
    contentTextarea.style.height = 'auto';
    
    console.log('입력 폼 초기화 완료 - 직원번호, 직원명, 기존 작성자 정보는 유지됨');
}



// 유틸리티 함수: 날짜 포맷팅
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 유틸리티 함수: 현재 시간 가져오기
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 디버깅용 로그 함수
function logData() {
    console.log('현재 날짜 (YYYYMMDD):', currentDate);
    console.log('management_note_total 데이터:', managementNoteData);
    console.log('management_note_individual 데이터:', individualWorkData);
}

// 인쇄 함수
function printReport() {
    window.print();
}

// A4용지 크기 조정 함수
function setupA4PaperResize() {
    const a4Paper = document.querySelector('.a4-paper');
    const reportContainer = document.querySelector('.report-container');
    
    if (!a4Paper || !reportContainer) return;
    
    function adjustA4PaperSize() {
        // A4용지 크기는 고정하고, 부모 컨테이너에서 스크롤 처리
        a4Paper.style.transform = 'none'; // transform 제거
        a4Paper.style.width = '210mm';
        a4Paper.style.minWidth = '210mm';
        
        // 부모 컨테이너에서 가로 스크롤 허용
        reportContainer.style.overflowX = 'auto';
        reportContainer.style.overflowY = 'auto';
    }
    
    // 초기 크기 조정
    adjustA4PaperSize();
    
    // 창 크기 변경 시 크기 조정
    window.addEventListener('resize', adjustA4PaperSize);
}

// 전역 함수로 노출 (디버깅용)
window.logData = logData;
window.loadReportData = loadReportData;
window.printReport = printReport;

// 커스텀 Alert 함수
function customAlert(message, title = '알림') {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="custom-modal">
                <div class="custom-modal-content">
                    <div class="custom-modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="custom-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="custom-modal-footer">
                        <button class="custom-btn custom-btn-primary" id="customAlertOk">확인</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('.custom-modal');
        const okBtn = document.getElementById('customAlertOk');
        
        const closeModal = () => {
            modal.remove();
            resolve();
        };
        
        okBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Enter 키로 확인
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                closeModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    });
}

// 커스텀 Confirm 함수
function customConfirm(message, title = '확인') {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="custom-modal">
                <div class="custom-modal-content">
                    <div class="custom-modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="custom-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="custom-modal-footer">
                        <button class="custom-btn custom-btn-secondary" id="customConfirmCancel">취소</button>
                        <button class="custom-btn custom-btn-primary" id="customConfirmOk">확인</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('.custom-modal');
        const okBtn = document.getElementById('customConfirmOk');
        const cancelBtn = document.getElementById('customConfirmCancel');
        
        const closeModal = (result) => {
            modal.remove();
            resolve(result);
        };
        
        okBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(false);
        });
        
        // Enter 키로 확인, Escape 키로 취소
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                closeModal(true);
                document.removeEventListener('keydown', handleKeyPress);
            } else if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    });
}

// 기존 alert/confirm을 커스텀 버전으로 교체
window.alert = customAlert;
window.confirm = customConfirm;

// 직원번호 가져오기 (모든 방법 지원)
function loadEmployeeNumberFromURL() {
    console.log('=== 직원번호 로드 시작 ===');
    
    // 입력 필드가 준비되었는지 확인
    if (!employeeNumberInput || !employeeNameInput) {
        console.error('직원번호 입력 필드가 준비되지 않았습니다.');
        return;
    }
    
    let employeeNumber = null;
    let urlHasEmployeeNumber = false;
    
    // 1. URL 파라미터에서 확인 (empNo 파라미터)
    const urlParams = new URLSearchParams(window.location.search);
    const empNoFromURL = urlParams.get('empNo');
    const employeeNumberFromURL = urlParams.get('employeeNumber');
    employeeNumber = empNoFromURL || employeeNumberFromURL;
    
    // URL에서 직원번호를 가져왔는지 확인
    if (empNoFromURL || employeeNumberFromURL) {
        urlHasEmployeeNumber = true;
    }
    
    console.log('URL 파라미터 확인:');
    console.log('- empNo:', empNoFromURL);
    console.log('- employeeNumber:', employeeNumberFromURL);
    console.log('- 최종 URL 결과:', employeeNumber);
    console.log('- URL에서 직원번호 가져옴:', urlHasEmployeeNumber);
    
    // 2. sessionStorage에서 확인
    if (!employeeNumber) {
        const empNoFromSession = sessionStorage.getItem('empNo');
        const currentUserFromSession = sessionStorage.getItem('currentUser');
        const userInfoFromSession = sessionStorage.getItem('userInfo');
        
        employeeNumber = empNoFromSession || currentUserFromSession || userInfoFromSession;
        
        console.log('sessionStorage 확인:');
        console.log('- empNo:', empNoFromSession);
        console.log('- currentUser:', currentUserFromSession);
        console.log('- userInfo:', userInfoFromSession);
        console.log('- 최종 sessionStorage 결과:', employeeNumber);
    }
    
    // 3. localStorage에서 확인
    if (!employeeNumber) {
        const employeeNumberFromLocal = localStorage.getItem('employeeNumber');
        employeeNumber = employeeNumberFromLocal;
        
        console.log('localStorage 확인:');
        console.log('- employeeNumber:', employeeNumberFromLocal);
        console.log('- 최종 localStorage 결과:', employeeNumber);
    }
    
    // 4. userInfo 요소에서 확인
    if (!employeeNumber) {
        const userInfoElement = document.getElementById('userInfo');
        console.log('userInfo 요소 확인:');
        console.log('- userInfo 요소 존재:', !!userInfoElement);
        
        if (userInfoElement) {
            const userInfoText = userInfoElement.textContent;
            console.log('- userInfo 텍스트:', userInfoText);
            
            const match = userInfoText.match(/([A-Za-z0-9]+)\s*님/);
            console.log('- 정규식 매치 결과:', match);
            
            employeeNumber = match ? match[1].toLowerCase() : null;
            console.log('- userInfo에서 추출한 직원번호:', employeeNumber);
        }
    }
    
    console.log('=== 최종 직원번호 결과:', employeeNumber, '===');
    
    if (employeeNumber) {
        // 직원번호 입력필드에 설정
        employeeNumberInput.value = employeeNumber;
        console.log('직원번호 입력필드에 설정됨:', employeeNumberInput.value);
        
        // URL에서 직원번호를 가져왔다면 URL 정리 (보안) - 직원명 조회와 독립적으로 실행
        if (urlHasEmployeeNumber) {
            cleanURLFromEmployeeNumber();
        }
        
        // 직원번호가 있으면 직원명도 자동으로 가져오기 (비동기로 실행)
        loadEmployeeName(employeeNumber);
        
        console.log('직원번호 자동 설정 완료:', employeeNumber);
    } else {
        console.log('❌ 직원번호를 찾을 수 없습니다!');
        console.log('현재 URL:', window.location.href);
        console.log('현재 페이지 제목:', document.title);
    }
    
    console.log('=== 직원번호 로드 완료 ===');
}

// URL에서 직원번호 파라미터 제거 (보안)
function cleanURLFromEmployeeNumber() {
    try {
        const currentURL = new URL(window.location.href);
        const searchParams = currentURL.searchParams;
        
        // 직원번호 관련 파라미터 제거
        searchParams.delete('empNo');
        searchParams.delete('employeeNumber');
        
        // 새로운 URL 생성
        const newURL = currentURL.origin + currentURL.pathname;
        const newSearchParams = searchParams.toString();
        const finalURL = newSearchParams ? `${newURL}?${newSearchParams}` : newURL;
        
        // 브라우저 히스토리 업데이트 (페이지 새로고침 없이)
        window.history.replaceState({}, document.title, finalURL);
        
        console.log('URL에서 직원번호 파라미터 제거 완료');
        console.log('새로운 URL:', finalURL);
    } catch (error) {
        console.log('URL 정리 중 오류:', error);
    }
}

// 직원번호로 직원명 가져오기 (선택사항)
async function loadEmployeeName(employeeNumber) {
    console.log('=== 직원명 로드 시작 ===');
    console.log('조회할 직원번호:', employeeNumber);
    
    const supabaseClient = getSupabaseClient();
    // Supabase 클라이언트 확인
    if (!supabaseClient) {
        console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
        return;
    }
    
    try {
        // 방법 1: 정확한 매칭으로 단일 행 조회
        console.log('정확한 매칭으로 직원 조회 중...');
        const { data: exactMatch, error: exactError } = await supabaseClient
            .from('employeesinfo')
            .select('직원명')
            .eq('직원번호', employeeNumber)
            .single();
        
        console.log('Supabase 쿼리 결과:');
        console.log('- data:', exactMatch);
        console.log('- error:', exactError);
        
        if (exactMatch && !exactError) {
            employeeNameInput.value = exactMatch.직원명 || '';
            console.log('직원명 설정 완료:', employeeNameInput.value);
            return;
        }
        
        // 방법 2: 대소문자 무시 매칭 (ilike 사용)
        console.log('대소문자 무시 매칭으로 재시도 중...');
        const { data: ilikeResult, error: ilikeError } = await supabaseClient
            .from('employeesinfo')
            .select('직원명')
            .ilike('직원번호', employeeNumber)
            .limit(1);
        
        console.log('ilike 쿼리 결과:');
        console.log('- data:', ilikeResult);
        console.log('- error:', ilikeError);
        
        if (ilikeResult && ilikeResult.length > 0 && !ilikeError) {
            employeeNameInput.value = ilikeResult[0].직원명 || '';
            console.log('ilike로 직원명 설정 완료:', employeeNameInput.value);
            return;
        }
        
        // 방법 3: 전체 데이터를 가져와서 클라이언트에서 필터링
        console.log('전체 데이터에서 클라이언트 필터링 중...');
        const { data: allEmployees, error: allError } = await supabaseClient
            .from('employeesinfo')
            .select('직원번호, 직원명');
        
        if (allEmployees && !allError) {
            const matchedEmployee = allEmployees.find(emp => 
                emp.직원번호 && emp.직원번호.toLowerCase() === employeeNumber.toLowerCase()
            );
            
            if (matchedEmployee) {
                employeeNameInput.value = matchedEmployee.직원명 || '';
                console.log('클라이언트 필터링으로 직원명 설정 완료:', employeeNameInput.value);
                return;
            }
        }
        
        console.log('직원명 조회 실패 또는 데이터 없음');
        
    } catch (error) {
        console.log('직원명 로드 실패:', error);
        console.log('에러 상세:', error.message);
    }
    
    console.log('=== 직원명 로드 완료 ===');
}

// PostMessage 통신 설정
function setupPostMessageListener() {
    console.log('=== PostMessage 리스너 설정 시작 ===');
    
    // PostMessage로 직원번호 요청
    window.addEventListener('message', function(event) {
        console.log('PostMessage 수신:', event.data);
        
        if (event.data && event.data.type === 'requestUserInfo') {
            console.log('직원번호 요청 메시지 수신');
            const currentUserEmpNo = getCurrentEmployeeNumber();
            console.log('현재 직원번호:', currentUserEmpNo);
            
            if (currentUserEmpNo) {
                event.source.postMessage({
                    type: 'userInfo',
                    userId: currentUserEmpNo,
                    empNo: currentUserEmpNo,
                    user: currentUserEmpNo
                }, '*');
                console.log('PostMessage로 직원번호 전송:', currentUserEmpNo);
            }
        } else if (event.data && event.data.type === 'userInfo') {
            console.log('직원번호 정보 수신:', event.data);
            if (event.data.empNo) {
                console.log('PostMessage로 받은 직원번호:', event.data.empNo);
                employeeNumberInput.value = event.data.empNo;
                loadEmployeeName(event.data.empNo);
            }
        }
    });
    
    // 부모 창에 직원번호 요청
    if (window.opener) {
        console.log('부모 창 존재, 직원번호 요청 전송');
        window.opener.postMessage({ type: 'requestUserInfo' }, '*');
    } else {
        console.log('부모 창 없음 (window.opener가 null)');
    }
    
    console.log('=== PostMessage 리스너 설정 완료 ===');
}

// 현재 직원번호 가져오기
function getCurrentEmployeeNumber() {
    // 1. 입력필드에서 확인
    if (employeeNumberInput.value) {
        return employeeNumberInput.value;
    }
    
    // 2. sessionStorage에서 확인
    let employeeNumber = sessionStorage.getItem('empNo') || 
                        sessionStorage.getItem('currentUser') || 
                        sessionStorage.getItem('userInfo');
    
    // 3. localStorage에서 확인
    if (!employeeNumber) {
        employeeNumber = localStorage.getItem('employeeNumber');
    }
    
    // 4. userInfo 요소에서 확인
    if (!employeeNumber) {
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement) {
            const userInfoText = userInfoElement.textContent;
            const match = userInfoText.match(/([A-Za-z0-9]+)\s*님/);
            employeeNumber = match ? match[1].toLowerCase() : null;
        }
    }
    
    return employeeNumber;
}

// text-area 더블클릭 이벤트 설정
function setupTextareaDoubleClickEvents() {
    // 전달사항 text-area 더블클릭
    handoverContent.addEventListener('dblclick', function() {
        showEditModal('전달사항');
    });
    
    // 어르신 특이사항 text-area 더블클릭
    elderlyContent.addEventListener('dblclick', function() {
        showEditModal('어르신 특이사항');
    });
    
    // 기본규칙 text-area 더블클릭
    basicRulesContent.addEventListener('dblclick', function() {
        showEditModal('기본규칙');
    });
    
    // 기타사항 text-area 더블클릭
    otherMattersContent.addEventListener('dblclick', function() {
        showEditModal('기타사항');
    });
}

// 편집 모달 표시
function showEditModal(category) {
    // 해당 카테고리의 데이터 찾기
    const categoryData = managementNoteData.filter(item => item.카테고리 === category);
    
    let currentContent = '';
    let originalEmployeeNumber = '';
    let originalEmployeeName = '';
    
    if (categoryData.length > 0) {
        // 첫 번째 데이터의 기존 작성자 정보 설정
        const firstData = categoryData[0];
        originalEmployeeNumber = firstData.직원번호 || '';
        originalEmployeeName = firstData.직원명 || '';
        
        // 모든 내용을 합쳐서 로드
        currentContent = categoryData.map(item => item.내용).join('\n\n');
    }
    
    // 모달 HTML 생성
    const modalHtml = `
        <div id="editModal" class="edit-modal-overlay">
            <div class="edit-modal-content">
                <div class="edit-modal-header">
                    <h3>${category} 편집</h3>
                </div>
                <div class="edit-modal-body">
                    <form class="edit-modal-form">
                        <div class="edit-modal-form-row">
                            <div class="edit-modal-form-group">
                                <label for="modalEmployeeNumber">직원번호:</label>
                                <input type="text" id="modalEmployeeNumber" class="edit-modal-form-input" 
                                       value="${employeeNumberInput.value}" readonly>
                            </div>
                            <div class="edit-modal-form-group">
                                <label for="modalEmployeeName">직원명:</label>
                                <input type="text" id="modalEmployeeName" class="edit-modal-form-input" 
                                       value="${employeeNameInput.value}" readonly>
                            </div>
                        </div>
                        <div class="edit-modal-form-row">
                            <div class="edit-modal-form-group">
                                <label for="modalOriginalEmployeeNumber">기 작성 직원번호:</label>
                                <input type="text" id="modalOriginalEmployeeNumber" class="edit-modal-form-input" 
                                       value="${originalEmployeeNumber}" readonly>
                            </div>
                            <div class="edit-modal-form-group">
                                <label for="modalOriginalEmployeeName">기 작성 직원명:</label>
                                <input type="text" id="modalOriginalEmployeeName" class="edit-modal-form-input" 
                                       value="${originalEmployeeName}" readonly>
                            </div>
                        </div>
                        <div class="edit-modal-form-group">
                            <label for="modalContentTextarea">내용:</label>
                            <textarea id="modalContentTextarea" class="edit-modal-form-textarea" 
                                      placeholder="내용을 입력하세요">${currentContent}</textarea>
                        </div>
                    </form>
                </div>
                <div class="edit-modal-footer">
                    <button id="modalCancelBtn" class="edit-modal-btn edit-modal-btn-secondary">취소</button>
                    <button id="modalSubmitBtn" class="edit-modal-btn edit-modal-btn-primary">저장</button>
                </div>
            </div>
        </div>
    `;
    
    // 모달을 body에 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 모달 요소들 가져오기
    const modal = document.getElementById('editModal');
    const modalTextarea = document.getElementById('modalContentTextarea');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    
    // textarea 높이 자동 조정
    adjustModalTextareaHeight(modalTextarea);
    
    // textarea 입력 시 높이 자동 조정
    modalTextarea.addEventListener('input', function() {
        adjustModalTextareaHeight(this);
    });
    
    // 저장 버튼 클릭
    submitBtn.addEventListener('click', async function() {
        await submitModalData(category, modalTextarea.value);
        closeEditModal();
    });
    
    // 취소 버튼 클릭
    cancelBtn.addEventListener('click', function() {
        closeEditModal();
    });
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', function(e) {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });
    
    // Enter 키로 저장, Escape 키로 취소
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submitModalData(category, modalTextarea.value).then(() => {
                closeEditModal();
            });
        } else if (e.key === 'Escape') {
            closeEditModal();
        }
    };
    document.addEventListener('keydown', handleKeyPress);
    
    // 모달이 닫힐 때 이벤트 리스너 제거
    modal.addEventListener('remove', function() {
        document.removeEventListener('keydown', handleKeyPress);
    });
    
    // textarea에 포커스
    modalTextarea.focus();
}

// 모달 textarea 높이 자동 조정
function adjustModalTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// 모달 데이터 저장
async function submitModalData(category, content) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
        console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
        await customAlert('데이터베이스 연결에 문제가 있습니다.', '오류');
        return;
    }
    
    // 입력값 검증
    const employeeNumber = employeeNumberInput.value.trim();
    const employeeName = employeeNameInput.value.trim();
    const trimmedContent = content.trim();
    
    // 직원번호 입력 확인
    if (!employeeNumber) {
        await customAlert('직원번호를 입력해주세요.', '직원번호 입력');
        return;
    }
    
    // 내용 입력 확인
    if (!trimmedContent) {
        await customAlert('내용을 입력해주세요.', '내용 입력');
        return;
    }
    
    try {
        let result;
        
        // 날짜와 카테고리로 기존 데이터 확인
        console.log('날짜와 카테고리로 기존 데이터 확인:', currentDate, category);
            
        const { data: existingData, error: fetchError } = await supabaseClient
                .from('management_note_total')
                .select('*')
            .eq('날짜', currentDate)
            .eq('카테고리', category)
                .single();
            
        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('기존 데이터 조회 에러:', fetchError);
            await customAlert('데이터 조회 중 오류가 발생했습니다.', '오류');
                return;
            }
            
        if (existingData) {
            // 기존 데이터가 있으면 업데이트
            console.log('기존 데이터 업데이트:', existingData.id);
            
            const { data, error } = await supabaseClient
                .from('management_note_total')
                .update({
                    직원번호: employeeNumber,
                    직원명: employeeName,
                    내용: trimmedContent
                })
                .eq('날짜', currentDate)
                .eq('카테고리', category);
            
            if (error) {
                console.error('데이터 업데이트 에러:', error);
                await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
                return;
            }
            
            result = data;
            console.log('데이터 업데이트 성공:', result);
        } else {
            // 새 데이터 삽입
            console.log('새 데이터 삽입');
            const { data, error } = await supabaseClient
                .from('management_note_total')
                .insert([
                    {
                        직원번호: employeeNumber,
                        직원명: employeeName,
                        날짜: currentDate,
                        카테고리: category,
                        내용: trimmedContent
                    }
                ]);
            
            if (error) {
                console.error('데이터 입력 에러:', error);
                await customAlert('데이터 입력 중 오류가 발생했습니다.', '오류');
                return;
            }
            
            result = data;
            console.log('데이터 입력 성공:', result);
        }
        
        // 보고서 데이터 다시 로드
        await loadReportData();
        
        await customAlert(
            existingData ? '데이터가 성공적으로 업데이트되었습니다.' : '데이터가 성공적으로 입력되었습니다.',
            '완료'
        );
        
    } catch (error) {
        console.error('데이터 처리 중 예외 발생:', error);
        await customAlert('데이터 처리 중 오류가 발생했습니다.', '오류');
    }
}

// 편집 모달 닫기
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
}

// text-area 내용을 편집 패널에 로드 (기존 함수 유지 - 편집 패널에서 사용)
function loadTextareaToEditPanel(category) {
    // 카테고리 선택
    categorySelect.value = category;
    
    // 해당 카테고리의 데이터 찾기
    const categoryData = managementNoteData.filter(item => item.카테고리 === category);
    
    if (categoryData.length > 0) {
        // 첫 번째 데이터의 기존 작성자 정보 설정
        const firstData = categoryData[0];
        
        // 직원번호와 직원명은 현재 로그인한 사용자 정보로 유지 (변경하지 않음)
        // employeeNumberInput.value = firstData.직원번호 || '';
        // employeeNameInput.value = firstData.직원명 || '';
        
        // 기존 작성자 정보 표시
        originalEmployeeNumberInput.value = firstData.직원번호 || '';
        originalEmployeeNameInput.value = firstData.직원명 || '';
        
        // 모든 내용을 합쳐서 textarea에 로드
        const allContent = categoryData.map(item => item.내용).join('\n\n');
        contentTextarea.value = allContent;
        
        // textarea 높이 자동 조정
        adjustTextareaHeight();
        
        // 편집 패널로 스크롤
        document.querySelector('.edit-panel').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        console.log(`${category} 카테고리 편집 패널에 로드 완료`);
    } else {
        // 데이터가 없으면 카테고리만 선택
        contentTextarea.value = '';
        // 직원번호와 직원명은 현재 로그인한 사용자 정보로 유지 (변경하지 않음)
        // employeeNumberInput.value = '';
        // employeeNameInput.value = '';
        // 기존 작성자 정보도 초기화
        originalEmployeeNumberInput.value = '';
        originalEmployeeNameInput.value = '';
        console.log(`${category} 카테고리 데이터 없음`);
    }
}
