// ----------------------------------------------------
// 1. 초기 설정 및 상태 변수
// ----------------------------------------------------
const BOOTH_ID = 'CR1'; 

// index.js (클라이언트)의 API_ENDPOINT 수정
const API_ENDPOINT = 'https://3491349131.netlify.app/api/sendReservationEmail';


const loginArea = document.getElementById('admin-login-area');
const dashboard = document.getElementById('admin-dashboard');
const loginBtn = document.getElementById('admin-login-btn');
const logoutBtn = document.getElementById('admin-logout-btn');
const loginErrorMsg = document.getElementById('login-error-msg');
const emailInput = document.getElementById('admin-email');
const passwordInput = document.getElementById('admin-password');

// 모달 관련 요소 정의
const reservationModal = document.getElementById('reservation-modal');
const modalDetailsContent = document.getElementById('modal-details-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCheckinBtn = document.getElementById('modal-checkin-btn');

const modalSendEmailBtn = document.getElementById('modal-send-email-btn');


let firebaseApp;
let database;
        
// 2. Firebase 초기화 및 인증 설정
// ----------------------------------------------------
async function initializeAdminFirebase() {
    // 🚨🚨🚨 이 부분을 수정합니다! 🚨🚨🚨
    // config.json 로드 경로: 현재 폴더에서 바로 로드
    const configResponse = await fetch('./config.json'); // 또는 'config.json'
    
    // 이전에 에러가 발생했다면, 여기서 catch 블록을 추가하여 오류를 확인합니다.
    if (!configResponse.ok) {
        console.error("Failed to load config.json:", configResponse.status, configResponse.statusText);
        loginErrorMsg.textContent = '시스템 설정 파일 로드 실패. 개발자에게 문의하세요.';
        return; // 로드 실패 시 초기화 중단
    }
    
    const config = await configResponse.json();

    if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(config.firebaseConfig);
    }
    database = firebase.database();
    
    // 🚨🚨🚨 Firebase 초기화 완료 후, 버튼 활성화 (유지) 🚨🚨🚨
    loginBtn.disabled = false; 
    
    // Firebase Authentication 리스너 설정
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            showDashboard();
            loadAllStatusListeners(); 
        } else {
            showLogin();
        }
    });

    // 🚨🚨🚨 로그인/로그아웃 리스너는 이제 initializeAdminFirebase 내부로 이동했거나 (이전 단계),
    // 오류 방지를 위해 아래 섹션 4에서 완전히 제거되었습니다. 🚨🚨🚨
}

        // ----------------------------------------------------
        // 3. UI 상태 관리
        // ----------------------------------------------------
        function showDashboard() {
            loginArea.style.display = 'none';
            dashboard.style.display = 'block';
            document.querySelector('#admin-dashboard header h2').textContent = `통합 부스 관리 대시보드 (${BOOTH_ID})`;
        }

        function showLogin() {
            loginArea.style.display = 'block';
            dashboard.style.display = 'none';
            loginErrorMsg.textContent = '';
        }

        // ----------------------------------------------------
        // 4. 이벤트 리스너: 로그인/로그아웃 (🚨 오류 방지를 위해 재정의)
        // ----------------------------------------------------
        // Firebase Auth 호출을 지연시키는 방식으로 재작성합니다.
        loginBtn.addEventListener('click', () => {
            // 이 코드가 실행될 때쯤에는 initializeAdminFirebase가 완료되어야 합니다.
            // 하지만 만약의 오류 방지를 위해 로직을 보강합니다.
            if (!firebaseApp || !firebase.auth) {
                 loginErrorMsg.textContent = '시스템 초기화 중입니다. 잠시 후 다시 시도해주세요.';
                 console.error("Firebase not initialized yet. Cannot sign in.");
                 return; // 초기화가 안됐으면 함수 종료
            }

            const email = emailInput.value;
            const password = passwordInput.value;

            firebase.auth().signInWithEmailAndPassword(email, password)
                .then(() => {
                    loginErrorMsg.textContent = '로그인 성공!';
                    emailInput.value = '';
                    passwordInput.value = '';
                })
                .catch(error => {
                    loginErrorMsg.textContent = `로그인 실패: ${error.message}`;
                    console.error("Login Error:", error);
                });
        });

        logoutBtn.addEventListener('click', () => {
             if (!firebaseApp || !firebase.auth) {
                 console.error("Firebase not initialized yet. Cannot sign out.");
                 return; 
             }
             firebase.auth().signOut();
        });

        // ----------------------------------------------------
        // 5. 실시간 데이터 로드 및 업데이트 (대시보드 핵심)
        // ----------------------------------------------------
        function loadAllStatusListeners() {
            // 5-1. 사전 예약 잔여 인원 실시간 업데이트
            database.ref(`booths/${BOOTH_ID}/slots`).on('value', snapshot => {
                const slots = snapshot.val();
                const slotListDiv = document.getElementById('slot-status-list');
                slotListDiv.innerHTML = '';
                if (slots) {
                    for (const time in slots) {
                        slotListDiv.innerHTML += `<p><strong>${time}:</strong> 잔여 ${slots[time]}석</p>`;
                    }
                } else {
                     slotListDiv.innerHTML = `<p>현재 등록된 예약 슬롯이 없습니다.</p>`;
                }
            });

            // 5-2. 현장 대기열 현황 실시간 업데이트
            database.ref(`booths/${BOOTH_ID}/queue`).on('value', snapshot => {
                const queueData = snapshot.val();
                if (queueData) {
                    document.getElementById('current-call-number').textContent = queueData.current_call || '0';
                }
            });

            // 5-3. 대기 명단 테이블 실시간 업데이트
            database.ref(`booths/${BOOTH_ID}/queue/waiting_list`).on('value', snapshot => {
                const waitingList = snapshot.val();
                const tableBody = document.querySelector('#waiting-list-table tbody');
                tableBody.innerHTML = '';
                let count = 0;

                if (waitingList) {
                    Object.keys(waitingList)
                        .map(key => ({ ...waitingList[key], key })) // 키를 데이터에 포함
                        .sort((a, b) => a.number - b.number) // 순번 기준으로 정렬
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
                                    <button onclick="handleQueueAction('${item.key}', 'active')" style="background-color: #3498db; color: white; margin-right: 5px;">입장</button>
                                    <button onclick="handleQueueAction('${item.key}', 'cancelled')" style="background-color: #f39c12; color: white;">노쇼/취소</button>
                                `;
                            }
                        });
                }
                document.getElementById('waiting-count').textContent = count;
            });
        }
        
        // ----------------------------------------------------
        // 6. 관리 액션 함수 (대기열)
        // ----------------------------------------------------
        // 대기열 상태 업데이트 (입장, 노쇼/취소)
        function handleQueueAction(key, status) {
             if (!database) { console.error("Database not initialized."); return; }
            database.ref(`booths/${BOOTH_ID}/queue/waiting_list/${key}`).update({ status })
                .then(() => alert(`대기자 ${key} 상태가 '${status}'로 업데이트 되었습니다.`))
                .catch(error => console.error("Update Error:", error));
        }

        // 다음 순번 호출
        document.getElementById('call-next-btn').addEventListener('click', () => {
             if (!database) { console.error("Database not initialized."); return; }
            database.ref(`booths/${BOOTH_ID}/queue/current_call`).transaction(current => {
                return (current || 0) + 1; 
            }, (error, committed, snapshot) => {
                if (error) console.error("Transaction failed: ", error);
                else if (committed) alert(`다음 순번 (${snapshot.val()}번) 호출 완료!`);
            });
        });

        // 대기열 초기화
        document.getElementById('reset-queue-btn').addEventListener('click', () => {
             if (!database) { console.error("Database not initialized."); return; }
            if (confirm("경고: 대기열의 모든 정보를 초기화하고 현재 호출 번호를 0으로 설정하시겠습니까?")) {
                database.ref(`booths/${BOOTH_ID}/queue`).set({
                    current_call: 0,
                    last_number: 0,
                    waiting_list: null // 리스트 비우기
                })
                .then(() => alert("대기열이 성공적으로 초기화되었습니다."))
                .catch(error => console.error("Reset Error:", error));
            }
        });
        
        // ----------------------------------------------------
        // 7. 관리 액션 함수 (예약 명단) - 이메일 발송 포함
        // ----------------------------------------------------
        
        // 예약 명단 불러오기 및 테이블 생성
        document.getElementById('load-reservations-btn').addEventListener('click', loadReservationList);

        function loadReservationList() {
             if (!database) { 
                 const tableBody = document.querySelector('#reserved-list-table tbody');
                 tableBody.innerHTML = '<tr><td colspan="4" style="color: red;">시스템 초기화 중. 잠시 후 버튼을 다시 눌러주세요.</td></tr>'; 
                 return; 
             }
            const tableBody = document.querySelector('#reserved-list-table tbody');
            tableBody.innerHTML = '<tr><td colspan="4">로딩 중...</td></tr>'; 
            
            database.ref('reservations').once('value')
                .then(snapshot => {
                    tableBody.innerHTML = '';
                    snapshot.forEach(childSnapshot => {
                        const reservationKey = childSnapshot.key; 
                        const reservation = childSnapshot.val();
                        
                        const displayId = reservation.reservationId || reservationKey.substring(0, 8); 

                        if (reservation.boothId === BOOTH_ID) {
                            const row = tableBody.insertRow();
                            row.onclick = () => showReservationDetails(reservation, reservationKey);
                            row.style.cursor = 'pointer'; 

                            row.insertCell(0).textContent = displayId;              
                            row.insertCell(1).textContent = reservation.name;      
                            row.insertCell(2).textContent = reservation.studentId; 
                            row.insertCell(3).textContent = reservation.timeSlot;  
                        }
                    });
                })
                .catch(error => {
                    console.error("Reservation Load Error:", error);
                    tableBody.innerHTML = '<tr><td colspan="4" style="color: red;">예약 명단 로드 중 오류 발생</td></tr>';
                });
        }
        
        // 예약 상태 업데이트 (체크인)
        function handleReservationAction(key, status) { // key는 Firebase 고유 키
             if (!database) { console.error("Database not initialized."); return; }
            database.ref(`reservations/${key}`).update({ status })
                .then(() => {
                    alert(`예약 ${key.substring(0, 8)} 상태가 '${status}'로 업데이트 되었습니다.`);
                    reservationModal.style.display = 'none'; 
                    loadReservationList(); 
                })
                .catch(error => console.error("Reservation Update Error:", error));
        }

// 🚨 이메일 발송을 위한 API 호출 함수
async function sendReservationEmail(reservation) {
    if (!reservation.email || reservation.email === 'NO_EMAIL') {
        alert("🚨 이 예약 건에는 이메일 정보가 없습니다. 발송할 수 없습니다.");
        return;
    }

    const confirmMessage = `${reservation.name}님(${reservation.email})에게 예약 알림 메일을 발송하시겠습니까?`;
    if (!confirm(confirmMessage)) return;

    // UI 상태 업데이트
    modalSendEmailBtn.disabled = true;
    const originalText = modalSendEmailBtn.textContent;
    modalSendEmailBtn.textContent = '발송 요청 중...';

    console.log("DEBUG: Firebase를 통해 발송 신호 전달 시작", reservation.reservationKey);

    // 🚀 [핵심] Firebase 데이터베이스의 해당 예약 정보를 업데이트
    // server.js의 .on('child_changed')가 이 변경을 감지함
    try {
        await database.ref(`reservations/${reservation.reservationKey}`).update({
            requestEmail: true, // 서버가 이 값을 보고 메일을 보냄
            requestTimestamp: firebase.database.ServerValue.TIMESTAMP // 요청 시간 기록
        });

        console.log("DEBUG: Firebase 업데이트 성공. server.js 감지 대기 중.");
        alert('📧 이메일 발송 요청이 전달되었습니다. (서버에서 발송 처리됨)');
        
    } catch (error) {
        console.error("DEBUG: Firebase 업데이트 실패:", error);
        alert('발송 요청 중 오류가 발생했습니다: ' + error.message);
    } finally {
        modalSendEmailBtn.disabled = false;
        modalSendEmailBtn.textContent = originalText;
    }
}

// ----------------------------------------------------
// 예약 상세 정보 팝업 표시 함수 (연계 유지)
// ----------------------------------------------------
function showReservationDetails(reservationData, reservationKey) {
    const statusText = reservationData.status || '예약 완료';
    const displayId = reservationData.reservationId || reservationKey.substring(0, 8); 
    
    modalDetailsContent.innerHTML = `
        <p><strong>예약 번호:</strong> ${displayId}</p>
        <p><strong>예약 상태:</strong> <span style="font-weight: bold; color: ${statusText === '체크인✅' ? 'green' : (statusText === 'cancelled' ? 'red' : 'blue')}">${statusText}</span></p>
        <p><strong>예약 시간:</strong> ${reservationData.timeSlot}</p>
        <p><strong>예약 인원:</strong> ${reservationData.partySize}명</p>
        <p><strong>이름 (학번):</strong> ${reservationData.name} (${reservationData.studentId})</p>
        <p><strong>연락처:</strong> ${reservationData.phone}</p>
        <p><strong>이메일:</strong> ${reservationData.email}</p>
    `;
    
    // 체크인 버튼 설정
    if (statusText === '체크인✅') {
        modalCheckinBtn.textContent = '이미 체크인 완료됨';
        modalCheckinBtn.disabled = true;
        modalCheckinBtn.style.backgroundColor = '#ccc';
    } else {
        modalCheckinBtn.textContent = '✅ 체크인 처리';
        modalCheckinBtn.disabled = false;
        modalCheckinBtn.style.backgroundColor = '#3cb371';
        modalCheckinBtn.onclick = () => handleReservationAction(reservationKey, '체크인✅');
    }

    // 📧 이메일 발송 버튼에 이벤트 연결 (전달받은 reservationKey 포함)
    const reservationWithKey = { ...reservationData, reservationKey };
    modalSendEmailBtn.onclick = () => sendReservationEmail(reservationWithKey);

    reservationModal.style.display = 'flex';
}

        // 팝업 닫기 버튼 이벤트
        modalCloseBtn.addEventListener('click', () => {
            reservationModal.style.display = 'none';
        });

        // ----------------------------------------------------
        // 페이지 로드 시 Firebase 초기화
        // ----------------------------------------------------
        document.addEventListener('DOMContentLoaded', initializeAdminFirebase);