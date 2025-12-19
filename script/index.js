// ----------------------------------------------------
// 1. 초기 설정 및 상태 변수
// ----------------------------------------------------
const BOOTH_ID = 'CR1'; 

// DOM 요소 정의 (안전한 접근을 위해 함수 내부에서 사용 권장하나 기존 구조 유지)
const loginArea = document.getElementById('admin-login-area');
const dashboard = document.getElementById('admin-dashboard');
const loginErrorMsg = document.getElementById('login-error-msg');

// 모달 관련 요소
const reservationModal = document.getElementById('reservation-modal');
const modalDetailsContent = document.getElementById('modal-details-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCheckinBtn = document.getElementById('modal-checkin-btn');
const modalSendEmailBtn = document.getElementById('modal-send-email-btn');

let firebaseApp;
let database;

// ----------------------------------------------------
// 2. 초기화 설정 (로그인 없이 바로 대시보드 실행)
// ----------------------------------------------------
async function initializeAdminFirebase() {
    try {
        // config.json 로드
        const configResponse = await fetch('./config.json');
        
        if (!configResponse.ok) {
            console.error("Failed to load config.json");
            if(loginErrorMsg) loginErrorMsg.textContent = '설정 파일 로드 실패.';
            return;
        }
        
        const config = await configResponse.json();

        // Firebase 초기화
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(config.firebaseConfig);
        }
        database = firebase.database();

        console.log("✅ 시스템 초기화 완료 (무로그인 모드)");

        // 🚨 로그인 절차 없이 바로 대시보드 표시 및 데이터 로드
        showDashboard();
        loadAllStatusListeners();

    } catch (error) {
        console.error("Initialization Error:", error);
    }
}

// ----------------------------------------------------
// 3. UI 상태 관리 (로그인 영역은 무조건 숨김)
// ----------------------------------------------------
function showDashboard() {
    if (loginArea) loginArea.style.display = 'none';
    if (dashboard) {
        dashboard.style.display = 'block';
        const headerTitle = document.querySelector('#admin-dashboard header h2');
        if (headerTitle) headerTitle.textContent = `통합 부스 관리 대시보드 (${BOOTH_ID})`;
    }
}

// ----------------------------------------------------
// 4. 실시간 데이터 로드 및 업데이트
// ----------------------------------------------------
function loadAllStatusListeners() {
    if (!database) return;

    // 4-1. 사전 예약 잔여 인원 실시간 업데이트
    database.ref(`booths/${BOOTH_ID}/slots`).on('value', snapshot => {
        const slots = snapshot.val();
        const slotListDiv = document.getElementById('slot-status-list');
        if (!slotListDiv) return;

        slotListDiv.innerHTML = '';
        if (slots) {
            for (const time in slots) {
                slotListDiv.innerHTML += `<p><strong>${time}:</strong> 잔여 ${slots[time]}석</p>`;
            }
        } else {
            slotListDiv.innerHTML = `<p>현재 등록된 예약 슬롯이 없습니다.</p>`;
        }
    });

    // 4-2. 현장 대기열 현황 업데이트
    database.ref(`booths/${BOOTH_ID}/queue`).on('value', snapshot => {
        const queueData = snapshot.val();
        const callDisplay = document.getElementById('current-call-number');
        if (queueData && callDisplay) {
            callDisplay.textContent = queueData.current_call || '0';
        }
    });

    // 4-3. 대기 명단 테이블 실시간 업데이트
    database.ref(`booths/${BOOTH_ID}/queue/waiting_list`).on('value', snapshot => {
        const waitingList = snapshot.val();
        const tableBody = document.querySelector('#waiting-list-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        let count = 0;

        if (waitingList) {
            Object.keys(waitingList)
                .map(key => ({ ...waitingList[key], key }))
                .sort((a, b) => a.number - b.number)
                .forEach(item => {
                    if (item.status !== 'completed' && item.status !== 'cancelled') {
                        count++;
                        const row = tableBody.insertRow();
                        row.insertCell(0).textContent = item.number;
                        row.insertCell(1).textContent = item.name;
                        row.insertCell(2).textContent = item.partySize;
                        row.insertCell(3).textContent = new Date(item.timestamp).toLocaleTimeString('ko-KR');

                        const actionCell = row.insertCell(4);
                        actionCell.innerHTML = `
                            <button onclick="handleQueueAction('${item.key}', 'active')" style="background-color: #3498db; color: white; margin-right: 5px; border:none; padding:5px 10px; cursor:pointer;">입장</button>
                            <button onclick="handleQueueAction('${item.key}', 'cancelled')" style="background-color: #f39c12; color: white; border:none; padding:5px 10px; cursor:pointer;">취소</button>
                        `;
                    }
                });
        }
        document.getElementById('waiting-count').textContent = count;
    });
}

// ----------------------------------------------------
// 5. 관리 액션 함수
// ----------------------------------------------------

// 대기열 상태 업데이트
window.handleQueueAction = function(key, status) {
    if (!database) return;
    database.ref(`booths/${BOOTH_ID}/queue/waiting_list/${key}`).update({ status })
        .catch(error => console.error("Update Error:", error));
};

// 다음 순번 호출 버튼
const callNextBtn = document.getElementById('call-next-btn');
if (callNextBtn) {
    callNextBtn.addEventListener('click', () => {
        if (!database) return;
        database.ref(`booths/${BOOTH_ID}/queue/current_call`).transaction(current => {
            return (current || 0) + 1; 
        }, (error, committed, snapshot) => {
            if (committed) alert(`다음 순번 (${snapshot.val()}번) 호출 완료!`);
        });
    });
}

// 다음 대기자 호출 버튼 (수정됨)
const callNextWaitingBtn = document.getElementById('call-next-waiting-btn');
if (callNextWaitingBtn) {
    callNextWaitingBtn.addEventListener('click', () => {
        if (!database) return;
        database.ref(`booths/${BOOTH_ID}/queue/current_call`).transaction(current => {
            return (current || 0) + 1;
        }, (error, committed, snapshot) => {
            if (committed) alert(`${snapshot.val()}번 학생을 호출했습니다.`);
        });
    });
}

// 대기열 초기화
const resetQueueBtn = document.getElementById('reset-queue-btn');
if (resetQueueBtn) {
    resetQueueBtn.addEventListener('click', () => {
        if (!database) return;
        if (confirm("대기열을 초기화하시겠습니까?")) {
            database.ref(`booths/${BOOTH_ID}/queue`).set({
                current_call: 0,
                last_number: 0,
                waiting_list: null
            }).then(() => alert("초기화되었습니다."));
        }
    });
}

// ----------------------------------------------------
// 6. 예약 명단 관리
// ----------------------------------------------------
const loadResBtn = document.getElementById('load-reservations-btn');
if (loadResBtn) {
    loadResBtn.addEventListener('click', loadReservationList);
}

async function loadReservationList() {
    if (!database) return;
    const tableBody = document.querySelector('#reserved-list-table tbody');
    tableBody.innerHTML = '<tr><td colspan="4">로딩 중...</td></tr>'; 
    
    database.ref('reservations').once('value')
        .then(snapshot => {
            tableBody.innerHTML = '';
            snapshot.forEach(childSnapshot => {
                const reservationKey = childSnapshot.key; 
                const reservation = childSnapshot.val();
                if (reservation.boothId === BOOTH_ID) {
                    const row = tableBody.insertRow();
                    row.onclick = () => showReservationDetails(reservation, reservationKey);
                    row.style.cursor = 'pointer'; 
                    row.insertCell(0).textContent = reservation.reservationId || reservationKey.substring(0, 8);
                    row.insertCell(1).textContent = reservation.name;      
                    row.insertCell(2).textContent = reservation.studentId; 
                    row.insertCell(3).textContent = reservation.timeSlot;  
                    row.insertCell(4).textContent = reservation.partySize;
                }
            });
        });
}

function showReservationDetails(reservationData, reservationKey) {
    const statusText = reservationData.status || '예약 완료';
    modalDetailsContent.innerHTML = `
        <p><strong>예약 번호:</strong> ${reservationData.reservationId || reservationKey.substring(0, 8)}</p>
        <p><strong>상태:</strong> ${statusText}</p>
        <p><strong>이름:</strong> ${reservationData.name} (${reservationData.studentId})</p>
        <p><strong>이메일:</strong> ${reservationData.email}</p>
    `;
    
    modalCheckinBtn.onclick = () => {
        database.ref(`reservations/${reservationKey}`).update({ status: '체크인✅' })
            .then(() => {
                alert('체크인 완료');
                reservationModal.style.display = 'none';
                loadReservationList();
            });
    };

    modalSendEmailBtn.onclick = () => {
        database.ref(`reservations/${reservationKey}`).update({
            requestEmail: true,
            requestTimestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => alert('이메일 요청 완료'));
    };

    reservationModal.style.display = 'flex';
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        reservationModal.style.display = 'none';
    });
}

// 초기화 시작
document.addEventListener('DOMContentLoaded', initializeAdminFirebase);