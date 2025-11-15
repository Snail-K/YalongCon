// 기존 방식을 사용한다면 밑의 파라미터로 URL을 기입
CheckSessionURL('');

// 옵션 설정
const socketOption = {
    reconnection: true,
    forceNew: true,
    timeout: 3000,
    transports: ["websocket"],
};
 
// 세션 연결
socket = io.connect(sessionURL, socketOption);
socket.on("connect", () => {
  addChatMessage(
    "chzzk",
    "DEBUG",
    `[SYSTEM] 치지직 연결`,
    { color:"red", escape:false }
  );
});

socket.on("disconnect", () => {
  addChatMessage(
    "chzzk",
    "DEBUG",
    `[SYSTEM] 치지직 연결 끊김`,
    { color:"red", escape:false }
  );
});

socket.on("SYSTEM", function (data) {
  console.log("SYSTEM: ", data);
  let jsonData = JSON.parse(data);

  switch (jsonData.type) {
    case "connected":
      addChatMessage(
        "chzzk",
        "DEBUG",
        `[SYSTEM] WebSocket 연결 완료 - 세션 키: ${jsonData.data.sessionKey}`,
        { color:"red", escape:false }
      );
      break;

    case "subscribed":
      addChatMessage(
        "chzzk",
        "DEBUG",
        `[SYSTEM] 구독 완료 - 이벤트 타입: ${jsonData.data.eventType}, 채널 ID: ${jsonData.data.channelId}`,
        { color:"red", escape:false }
      );
      break;

    default:
      addChatMessage(
        "chzzk",
        "DEBUG",
        `[SYSTEM] 알 수 없는 시스템 이벤트 수신 - 타입: ${type}`,
        { color:"red", escape:false }
      );
      break;
  }
});

socket.on("CHAT", function (response) {
  let jsonData = JSON.parse(response);

  // 데이터 파싱
  let messageContent = jsonData.content;
  let nickname = jsonData.profile.nickname;
  let extrasData = { emojis: jsonData.emojis };

  let data = {};
  data.message = messageContent;

  // 유저 이름색 지정
  if (!data.color || data.color == "") {
      let n = nickname.charCodeAt(0) + nickname.charCodeAt(1) * new Date().getDate();
      let defaultColors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF"]; // 기본 색상 예시
      data.color = defaultColors[n % defaultColors.length];
  }

  // 이모지 데이터 추가
  data.chzzk_emojis = extrasData.emojis;
  data.nick = jsonData.profile.nickname.replace(/\s+/g, '');
  data.badges = jsonData.profile.badges;

  // 메시지 출력 함수 호출
  addChatMessage('chzzk', nickname, messageContent, data);
});

socket.on("DONATION", function (response) {
  let jsonData = JSON.parse(response);
  console.log("DONATION: ", response);

  let extrasData = { emojis: jsonData.emojis };
  let data = {};

  // 이모지 데이터 추가
  data.chzzk_emojis = extrasData.emojis;
  data.nick = jsonData.donatorNickname.replace(/\s+/g, '');
  data.cheers = jsonData.payAmount;
  data.donationType = jsonData.donationType;

  addChatMessage("chzzk", jsonData.donatorNickname, jsonData.donationText, data);
});

socket.connect();

function CheckSessionURL(_sessionURL) {
  if(!sessionURL)
    sessionURL = _sessionURL
}