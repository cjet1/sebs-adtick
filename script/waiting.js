// Firebase 초기화 로직은 기존 info.js와 동일하게 사용하세요.
const BOOTH_ID = 'CR1'; 

async function registerWaiting() {
    const name = document.getElementById('waiting-name').value;
    const partySize = parseInt(document.getElementById('waiting-party').value);
    const phone = document.getElementById('waiting-phone').value;

    if (!name || !partySize || !phone) {
        alert("모든 정보를 입력해주세요.");
        return;
    }

    const queueRef = database.ref(`booths/${BOOTH_ID}/queue`);

    // 트랜잭션을 사용하여 안전하게 번호표 발행
    queueRef.transaction((currentData) => {
        if (currentData === null) {
            return { last_number: 1, current_call: 0 };
        }
        currentData.last_number = (currentData.last_number || 0) + 1;
        return currentData;
    }, async (error, committed, snapshot) => {
        if (committed) {
            const newNumber = snapshot.val().last_number;
            
            // 대기 명단에 상세 정보 추가
            await queueRef.child('waiting_list').push({
                number: newNumber,
                name: name,
                partySize: partySize,
                phone: phone,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'waiting'
            });

            alert(`대기 등록 완료! 당신의 번호는 ${newNumber}번입니다.`);
            // 번호 확인 페이지로 이동하거나 화면 갱신
        }
    });
}