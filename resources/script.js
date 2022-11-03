const DB_URL = "https://my-json-server.typicode.com/onstop4/CUS1172_Quiz_DB";

const PARTIALS = ["multiple-choice-question-template", "multiple-multiple-choice-question-template", "type-in-question-template", "checkboxes-question-template", "image-choice-question-template", "correct-answer-alert-template", "incorrect-answer-alert-template"];

const ERROR_MESSAGES = { "multiple-choice": "Sorry, but the correct answer is:", "multiple-multiple-choice": "Sorry, but the correct answers are:", "type-in": "Sorry, but you should have entered one of the following:", "checkboxes": "Sorry, but you should have selected only the following:", "image-choice": "Sorry, but you should have selected" };

let appState = {};

function displayElapsedTime() {
    let elapsedTime = appState.quiz.elapsedTime++;
    let hours = Math.floor(elapsedTime / 3600);
    let minutes = Math.floor((elapsedTime % 3600) / 60);
    let seconds = elapsedTime % 60;

    let elapsedTimeFormatted = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
    let element = document.querySelector("#elapsedTime");
    // Prevents updates to #elapsedTime if its not on the page (such as during the second after the user answers correctly).
    if (element !== null) {
        element.textContent = elapsedTimeFormatted;
    }
}

function switchToIndex() {
    let indexTemplate = Handlebars.compile(document.querySelector("#index-template").innerHTML);
    document.querySelector("#app").innerHTML = indexTemplate();
}

function switchToQuiz(quiz) {
    fetch(`${DB_URL}/details`)
        .then(response => response.json())
        .then(data => {
            appState.quiz = { id: quiz, current: -1, correct: 0, elapsedTime: 0, ...data[quiz] }
            advanceToNextQuestion();
        })
}

function switchToCompletion() {
    let completionTemplate = Handlebars.compile(document.querySelector("#completion-template").innerHTML);
    let score = (appState.quiz.correct / appState.quiz.length * 100).toFixed(0);
    document.querySelector("#app").innerHTML = completionTemplate({ quiz: appState.quiz, name: appState.name, score: score, passed: score > 80 });
    clearInterval(appState.timer);
}

function advanceToNextQuestion() {
    let app = document.querySelector("#app");
    if (++appState.quiz.current < appState.quiz.length) {
        fetch(`${DB_URL}/${appState.quiz.id}/${appState.quiz.current}`)
            .then(response => response.json())
            .then(data => {
                let quizTemplate = Handlebars.compile(document.querySelector("#quiz-template").innerHTML);
                appState.question = data;
                app.innerHTML = quizTemplate({ quiz: appState.quiz, current_question_count: appState.quiz.current + 1, question: data });
                // Elapsed time will only be displayed once quiz has rendered.
                displayElapsedTime();
                if (!appState.timer) {
                    appState.timer = setInterval(displayElapsedTime, 1000);
                }
            })
    } else {
        switchToCompletion();
    }
}

function submitInfoForm(event) {
    event.preventDefault();

    let formData = new FormData(event.target);
    appState.name = formData.get("name");

    switchToIndex();
}

function submitAnswer(event) {
    event.preventDefault();

    let form = event.target;
    let formData = new FormData(form);
    let question = appState.question;
    let success;
    let errorMessage = ERROR_MESSAGES[question.type];
    let correctAnswersForError = [];

    if (question.type === "multiple-choice") {
        success = formData.get("input") == question.answer;
        correctAnswersForError.push(question.choices[question.answer]);
    } else if (question.type === "multiple-multiple-choice") {
        success = true;
        for (let indexStr in question.answers) {
            index = Number(indexStr)
            if (question.answers[index] !== parseInt(formData.get(indexStr))) {
                success = false;
            }
            correctAnswersForError.push(question.subquestions[index] + " -> " + question.choices[index]);
        }
    } else if (question.type === "type-in") {
        success = question.answers.includes(formData.get("input"));
        correctAnswersForError.push(...question.answers);
    } else if (question.type === "checkboxes") {
        success = true;
        let length = 0;
        for (let value of formData.getAll("input")) {
            value = Number(value)
            if (!question.answer.includes(value)) {
                success = false;
            }
            length++;
        }
        correctAnswersForError.push(...question.answer.map(index => question.choices[index]));
        success = success && length === question.answer.length;
    } else if (question.type === "image-choice") {
        success = formData.get("input") == question.answer;
        switch (question.answer) {
            case 0:
                correctAnswersForError.push("the first image");
                break;
            case 1:
                correctAnswersForError.push("the second image");
                break;
            default:
                correctAnswersForError.push(`image ${question.answer + 1}`);
        }
    }

    if (success) {
        appState.quiz.correct++;
        let template = Handlebars.compile(document.querySelector("#correct-answer-alert-template").innerHTML);
        app.innerHTML = template();
        setTimeout(() => {
            advanceToNextQuestion();
        }, 1000);
    } else {
        form.querySelectorAll("input").forEach(input => {
            input.setAttribute("disabled", "");
        })

        form.querySelector("#quizSubmitButton").remove();

        let template = Handlebars.compile(document.querySelector("#incorrect-answer-alert-template").innerHTML);
        let errorAlert = document.createElement("div");
        errorAlert.innerHTML = template({ errorMessage: errorMessage, correctAnswers: correctAnswersForError });
        form.append(errorAlert);
    }
}

function advanceToNextQuestionAfterError(event) {
    event.preventDefault();
    advanceToNextQuestion();
}

document.addEventListener("DOMContentLoaded", function () {
    Handlebars.registerHelper("selectQuestionPartial", function (context, options) {
        return context.type + "-question-template";
    })

    Handlebars.registerHelper("randomSuccessMessage", function () {
        const array = ["Brilliant!", "Awesome!", "Good work!"];
        return array[Math.floor(Math.random() * array.length)];
    });

    for (let id of PARTIALS) {
        Handlebars.registerPartial(id, document.querySelector("#" + id).innerHTML);
    }

    let entryTemplate = Handlebars.compile(document.querySelector("#entry-template").innerHTML);
    document.querySelector("#app").innerHTML = entryTemplate();
})